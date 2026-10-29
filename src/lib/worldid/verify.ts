import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { creators } from "@/lib/db/schema";

export const WORLD_ACTION = "green-room-creator";
const EXPECTED_ENVIRONMENT = "production";

/** Nullifiers are 0x-prefixed 256-bit hex; Postgres stores them as NUMERIC(78,0) decimal strings. */
export function hexToDecimal(hex: string): string {
  if (!/^0x[0-9a-fA-F]+$/.test(hex)) throw new Error("Not a hex string");
  return BigInt(hex).toString(10);
}

const proofSchema = z.looseObject({
  environment: z.string(),
  responses: z.array(z.looseObject({ nullifier: z.string() })).min(1),
});

export type WorldIdVerification = { ok: true; nullifierHex: string } | { ok: false; reason: string };

/** Forwards an IDKit result unchanged to the Developer Portal and returns its nullifier when valid. */
export async function verifyWorldIdProof(
  idkitResponse: unknown,
  opts: { rpId: string; fetch?: typeof fetch },
): Promise<WorldIdVerification> {
  const parsed = proofSchema.safeParse(idkitResponse);
  if (!parsed.success) return { ok: false, reason: "malformed_proof" };
  if (parsed.data.environment !== EXPECTED_ENVIRONMENT) return { ok: false, reason: "wrong_environment" };

  const doFetch = opts.fetch ?? fetch;
  const response = await doFetch(`https://developer.world.org/api/v4/verify/${encodeURIComponent(opts.rpId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...parsed.data, environment: EXPECTED_ENVIRONMENT }),
  });
  if (!response.ok) return { ok: false, reason: `portal_${response.status}` };

  const verdict = (await response.json().catch(() => null)) as { success?: unknown; environment?: unknown } | null;
  if (verdict?.success !== true) return { ok: false, reason: "portal_rejected" };
  if (verdict.environment !== undefined && verdict.environment !== EXPECTED_ENVIRONMENT) {
    return { ok: false, reason: "wrong_environment" };
  }
  return { ok: true, nullifierHex: parsed.data.responses[0].nullifier };
}

/** Ties one World ID to one Green Room account, so a person cannot multiply their invite limit. */
export async function linkNullifier(
  db: Db,
  creatorId: string,
  nullifierHex: string,
): Promise<{ ok: true } | { ok: false; reason: "already_linked_elsewhere" }> {
  const nullifier = hexToDecimal(nullifierHex);
  const [owner] = await db
    .select({ id: creators.id })
    .from(creators)
    .where(and(eq(creators.nullifier, nullifier), ne(creators.id, creatorId)))
    .limit(1);
  if (owner) return { ok: false, reason: "already_linked_elsewhere" };

  try {
    await db.update(creators).set({ nullifier, verifiedAt: new Date() }).where(eq(creators.id, creatorId));
  } catch {
    // Unique constraint: another account linked the same nullifier between our check and this write.
    return { ok: false, reason: "already_linked_elsewhere" };
  }
  return { ok: true };
}
