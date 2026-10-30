import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read .env.local; `neon deploy` / `neon env pull` write the Neon URLs there.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations need a direct (non-pooled) connection; PgBouncer in transaction mode breaks session state.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
