import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { creators } from "@/lib/db/schema";
import { hexToDecimal, linkNullifier, verifyWorldIdProof } from "@/lib/worldid/verify";
import { makeTestDb } from "./helpers/db";

const proof = (environment = "production") => ({
  protocol_version: "4.0",
  nonce: "n-1",
  action: "green-room-creator",
  environment,
  responses: [{ identifier: "proof_of_human", nullifier: "0x0a", proof: ["0x1"], issuer_schema_id: 1 }],
});

const okPortal = () =>
  vi.fn(async () => new Response(JSON.stringify({ success: true, environment: "production" }), { status: 200 }));

describe("hexToDecimal", () => {
  it("converts small hex", () => {
    expect(hexToDecimal("0x0a")).toBe("10");
  });

  it("converts a full 256-bit nullifier exactly", () => {
    const hex = "0x" + "f".repeat(64);
    expect(hexToDecimal(hex)).toBe(
      "115792089237316195423570985008687907853269984665640564039457584007913129639935",
    );
  });

  it("rejects non-hex input", () => {
    expect(() => hexToDecimal("0xzz")).toThrow();
  });
});

describe("verifyWorldIdProof", () => {
  it("refuses a non-production proof without calling the portal", async () => {
    const fetch = okPortal();
    const result = await verifyWorldIdProof(proof("staging"), { rpId: "rp_test", fetch });
    expect(result.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the proof as-is to the v4 verify endpoint and returns the nullifier", async () => {
    const fetch = okPortal();
    const result = await verifyWorldIdProof(proof(), { rpId: "rp_test", fetch });
    expect(result).toEqual({ ok: true, nullifierHex: "0x0a" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://developer.world.org/api/v4/verify/rp_test");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({ nonce: "n-1", environment: "production" });
  });

  it("fails when the portal answers non-200", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 400 }));
    expect((await verifyWorldIdProof(proof(), { rpId: "rp_test", fetch })).ok).toBe(false);
  });

  it("fails when the portal says success is not true", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 }));
    expect((await verifyWorldIdProof(proof(), { rpId: "rp_test", fetch })).ok).toBe(false);
  });

  it("fails on a malformed payload with no nullifier", async () => {
    const fetch = okPortal();
    const bad = { ...proof(), responses: [] };
    expect((await verifyWorldIdProof(bad, { rpId: "rp_test", fetch })).ok).toBe(false);
  });
});

describe("linkNullifier (one human, one account)", () => {
  async function setup() {
    const db = await makeTestDb();
    const [a] = await db.insert(creators).values({ telegramId: 1, name: "A" }).returning();
    const [b] = await db.insert(creators).values({ telegramId: 2, name: "B" }).returning();
    return { db, a, b };
  }

  it("links a nullifier and marks the creator verified", async () => {
    const { db, a } = await setup();
    expect(await linkNullifier(db, a.id, "0x0a")).toEqual({ ok: true });
    const [row] = await db.select().from(creators).where(eq(creators.id, a.id));
    expect(row.nullifier).toBe("10");
    expect(row.verifiedAt).toBeInstanceOf(Date);
  });

  it("lets the same creator verify again with the same nullifier", async () => {
    const { db, a } = await setup();
    await linkNullifier(db, a.id, "0x0a");
    expect(await linkNullifier(db, a.id, "0x0a")).toEqual({ ok: true });
  });

  it("refuses the same human on a second Telegram account", async () => {
    const { db, a, b } = await setup();
    await linkNullifier(db, a.id, "0x0a");
    expect(await linkNullifier(db, b.id, "0x0a")).toEqual({ ok: false, reason: "already_linked_elsewhere" });
    const [row] = await db.select().from(creators).where(eq(creators.id, b.id));
    expect(row.verifiedAt).toBeNull();
  });
});
