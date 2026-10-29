import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/ratelimit";
import { makeTestDb } from "./helpers/db";

describe("checkRateLimit", () => {
  it("allows up to the limit in a window, then refuses with a retry time", async () => {
    const db = await makeTestDb();
    const t0 = new Date("2026-10-30T06:00:00Z");
    expect((await checkRateLimit(db, "brief:c1", 2, 3600, t0)).allowed).toBe(true);
    expect((await checkRateLimit(db, "brief:c1", 2, 3600, new Date(t0.getTime() + 1000))).allowed).toBe(true);
    const third = await checkRateLimit(db, "brief:c1", 2, 3600, new Date(t0.getTime() + 2000));
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBe(3598);
  });

  it("starts a fresh window once the old one has passed", async () => {
    const db = await makeTestDb();
    const t0 = new Date("2026-10-30T06:00:00Z");
    await checkRateLimit(db, "k", 1, 60, t0);
    expect((await checkRateLimit(db, "k", 1, 60, new Date(t0.getTime() + 30_000))).allowed).toBe(false);
    expect((await checkRateLimit(db, "k", 1, 60, new Date(t0.getTime() + 61_000))).allowed).toBe(true);
  });

  it("keeps separate counters per key", async () => {
    const db = await makeTestDb();
    const t0 = new Date("2026-10-30T06:00:00Z");
    await checkRateLimit(db, "a", 1, 60, t0);
    expect((await checkRateLimit(db, "b", 1, 60, t0)).allowed).toBe(true);
  });
});
