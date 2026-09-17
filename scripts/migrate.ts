import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const envConnectionString = process.env.SUPABASE_CONNECTION_KEY;
if (!envConnectionString) {
  throw new Error(
    "SUPABASE_CONNECTION_KEY is not set. Add the Postgres connection string to .env before running migrations.",
  );
}
const connectionString: string = envConnectionString;

async function main() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await client.end();
  console.log("Migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
