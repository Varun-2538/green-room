import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

/** Any Postgres-backed Drizzle database with our schema (Neon in production, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | undefined;

/**
 * node-postgres over Neon's pooled URL, as Neon recommends for Vercel Fluid compute.
 * attachDatabasePool lets Vercel close idle clients before a function instance is suspended.
 */
export function getDb(): Db {
  if (!db) {
    const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
    attachDatabasePool(pool);
    db = drizzle(pool, { schema }) as unknown as Db;
  }
  return db;
}
