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
  });

if (process.env.NODE_ENV !== "production") {
  global.__doitPgClient = client;
}

export const db = drizzle(client, { schema });
