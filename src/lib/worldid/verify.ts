import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { creators } from "@/lib/db/schema";

export const WORLD_ACTION = "green-room-creator";
const EXPECTED_ENVIRONMENT = "production";

/**
 * Nullifiers arrive as 0x-prefixed hex (World ID docs) or as decimal (IDKit v4 types say so);
 * Postgres stores them as NUMERIC(78,0) decimal strings.
 */
export function nullifierToDecimal(value: string): string {
  if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) throw new Error("Nullifier is neither hex nor decimal");
  return BigInt(value).toString(10);
}

// v4 only: a v3 (legacy) proof gives the same person a different nullifier, which would allow a second account.
const proofSchema = z.looseObject({
  protocol_version: z.literal("4.0"),
  environment: z.string(),
  responses: z.array(z.looseObject({ nullifier: z.string() })).min(1),
});

export type WorldIdVerification = { ok: true; nullifier: string } | { ok: false; reason: string };

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
  return { ok: true, nullifier: parsed.data.responses[0].nullifier };
}

/** Ties one World ID to one Green Room account, so a person cannot multiply their invite limit. */
export async function linkNullifier(
  db: Db,
  creatorId: string,
  rawNullifier: string,
): Promise<{ ok: true } | { ok: false; reason: "already_linked_elsewhere" }> {
  const nullifier = nullifierToDecimal(rawNullifier);
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
