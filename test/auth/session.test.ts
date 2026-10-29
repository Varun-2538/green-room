import { describe, expect, it } from "vitest";
import { createSessionCookie, readSession } from "@/lib/auth/session";

describe("session cookie", () => {
  it("round-trips the creator id", async () => {
    const cookie = await createSessionCookie("c0ffee00-0000-4000-8000-000000000001");
    expect(await readSession(cookie)).toEqual({
      creatorId: "c0ffee00-0000-4000-8000-000000000001",
    });
  });

  it("returns null for a tampered cookie", async () => {
    const cookie = await createSessionCookie("c0ffee00-0000-4000-8000-000000000001");
    const tampered = cookie.slice(0, -2) + (cookie.endsWith("A") ? "BB" : "AA");
    expect(await readSession(tampered)).toBeNull();
  });

  it("returns null when there is no cookie", async () => {
    expect(await readSession(undefined)).toBeNull();
  });
});
