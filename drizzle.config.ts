import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.SUPABASE_CONNECTION_KEY;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
  strict: true,
  verbose: true,
});
