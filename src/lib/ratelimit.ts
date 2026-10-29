import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { rateLimits } from "@/lib/db/schema";

/**
 * Fixed-window counter in Postgres, one atomic upsert per call, so it holds across serverless instances.
 * Protects paid upstreams (TinyFish, xAI) from runaway clients and the public MCP endpoint.
 */
export async function checkRateLimit(
  db: Db,
  key: string,
  limit: number,
  windowSec: number,
  now: Date = new Date(),
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const windowStartCutoff = new Date(now.getTime() - windowSec * 1000);
  const expired = sql`${rateLimits.windowStart} <= ${windowStartCutoff.toISOString()}::timestamptz`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN ${now.toISOString()}::timestamptz ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning();

  const allowed = row.count <= limit;
  const resetsAt = row.windowStart.getTime() + windowSec * 1000;
  return { allowed, retryAfterSec: allowed ? 0 : Math.max(1, Math.ceil((resetsAt - now.getTime()) / 1000)) };
}
