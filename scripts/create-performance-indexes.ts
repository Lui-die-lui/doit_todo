import { config as loadEnv } from "dotenv";
import postgres from "postgres";

const INDEX_STATEMENTS = [
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS doit_plans_user_active_start_idx
     ON doit_plans (user_id, start_date DESC, id ASC)
     WHERE deleted_at IS NULL`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS doit_plans_user_created_idx
     ON doit_plans (user_id, created_at DESC, id ASC)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS doit_tasks_plan_active_idx
     ON doit_tasks (plan_id)
     WHERE deleted_at IS NULL`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS doit_work_logs_task_start_idx
     ON doit_work_logs (task_id, start_at DESC)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS doit_reflections_plan_period_idx
     ON doit_reflections (plan_id, period_end DESC)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS doit_reflections_plan_created_idx
     ON doit_reflections (plan_id, created_at DESC)`,
] as const;

const ADVISORY_LOCK_KEY = "doit-performance-indexes-v1";

function migrationConnectionString(connectionString: string) {
  const url = new URL(connectionString);
  if (url.port === "6543") {
    if (!url.hostname.includes("pooler")) {
      throw new Error("Transaction-pooler port 6543 cannot be used for this operation.");
    }
    // Supabase shared-pooler hostnames expose transaction mode on 6543 and
    // session mode on 5432. Session mode is required for SET and advisory locks.
    url.port = "5432";
    console.log("Using the Supabase session-pooler endpoint for this operation.");
  }
  return url.toString();
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!apply) {
    console.log("Dry run only. No environment file was loaded and no database connection was opened.");
    console.log("Run `npm run db:indexes:performance -- --apply` only after completing the rollout preflight.");
    for (const statement of INDEX_STATEMENTS) console.log(`\n${statement};`);
    return;
  }

  loadEnv();
  const connectionString = process.env.SUPABASE_CONNECTION_KEY;
  if (!connectionString) throw new Error("SUPABASE_CONNECTION_KEY is not set.");

  const client = postgres(migrationConnectionString(connectionString), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
    ssl: "require",
  });

  let lockAcquired = false;
  try {
    const [lock] = await client<{ acquired: boolean }[]>`
      select pg_try_advisory_lock(hashtext(${ADVISORY_LOCK_KEY})) as acquired
    `;
    lockAcquired = lock?.acquired === true;
    if (!lockAcquired) throw new Error("Another performance-index operation is already running.");

    await client.unsafe("SET lock_timeout = '2s'");

    const [databaseState] = await client<{
      readOnly: boolean;
      canCreate: boolean;
      longTransactions: number;
      concurrentBuilds: number;
    }[]>`
      select
        pg_is_in_recovery() as "readOnly",
        has_database_privilege(current_user, current_database(), 'CREATE') as "canCreate",
        (
          select count(*)::int
          from pg_stat_activity
          where xact_start is not null
            and pid <> pg_backend_pid()
            and now() - xact_start > interval '5 minutes'
        ) as "longTransactions",
        (select count(*)::int from pg_stat_progress_create_index) as "concurrentBuilds"
    `;

    if (databaseState?.readOnly) throw new Error("The target database is read-only.");
    if (!databaseState?.canCreate) throw new Error("The connected role does not have CREATE privilege.");
    if (databaseState.longTransactions > 0) {
      throw new Error(`Preflight found ${databaseState.longTransactions} transaction(s) older than five minutes.`);
    }
    if (databaseState.concurrentBuilds > 0) {
      throw new Error("Another concurrent index build is already running.");
    }

    const invalidBefore = await client<{ index_name: string }[]>`
      select index_class.relname as index_name
      from pg_index index_state
      join pg_class index_class on index_class.oid = index_state.indexrelid
      join pg_class table_class on table_class.oid = index_state.indrelid
      where table_class.relname like 'doit_%'
        and not index_state.indisvalid
    `;
    if (invalidBefore.length > 0) {
      throw new Error(`Preflight found invalid indexes: ${invalidBefore.map((row) => row.index_name).join(", ")}`);
    }

    console.log("Preflight passed: writable database, DDL privilege, no long transaction, and no conflicting build.");

    for (const statement of INDEX_STATEMENTS) {
      const indexName = statement.match(/EXISTS\s+([a-z0-9_]+)/i)?.[1] ?? "unknown";
      console.log(`Creating ${indexName}...`);
      await client.unsafe(statement);
      console.log(`Created ${indexName}.`);
    }

    const invalidIndexes = await client<{ index_name: string }[]>`
      select index_class.relname as index_name
      from pg_index index_state
      join pg_class index_class on index_class.oid = index_state.indexrelid
      join pg_class table_class on table_class.oid = index_state.indrelid
      where table_class.relname like 'doit_%'
        and not index_state.indisvalid
    `;

    if (invalidIndexes.length > 0) {
      throw new Error(`Invalid indexes remain: ${invalidIndexes.map((row) => row.index_name).join(", ")}`);
    }

    console.log("All performance indexes are present and valid.");
  } finally {
    if (lockAcquired) {
      await client<{ unlocked: boolean }[]>`
        select pg_advisory_unlock(hashtext(${ADVISORY_LOCK_KEY})) as unlocked
      `;
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error("Performance-index operation failed:", error);
  process.exitCode = 1;
});
