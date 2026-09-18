import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.SUPABASE_CONNECTION_KEY;

if (!connectionString) {
  throw new Error(
    "SUPABASE_CONNECTION_KEY is not set. Add the Postgres connection string to your server environment (.env, never NEXT_PUBLIC_).",
  );
}

declare global {
  var __doitPgClient: ReturnType<typeof postgres> | undefined;
}

const client =
  global.__doitPgClient ??
  postgres(connectionString, {
    prepare: false,
    max: 5,
    // Without these, a connection that can't be established (e.g. the shared Supabase
    // pooler already at its connection cap) hangs the request indefinitely instead of
    // failing into the existing try/catch error paths, and a dev-server restart that
    // doesn't get a clean shutdown can otherwise leave connections open until Postgres's
    // own (much longer) timeout reaps them.
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });

if (process.env.NODE_ENV !== "production") {
  global.__doitPgClient = client;
}

export const db = drizzle(client, { schema });
