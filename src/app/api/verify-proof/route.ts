import { NextResponse } from "next/server";
import { currentCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { linkNullifier, verifyWorldIdProof } from "@/lib/worldid/verify";

const ALREADY_LINKED_MESSAGE = "This World ID is already linked to another Green Room account.";

export async function POST(request: Request) {
  const db = getDb();
  const creator = await currentCreator(db);
  if (!creator) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const verification = await verifyWorldIdProof(body, { rpId: env.NEXT_PUBLIC_WORLD_RP_ID });
  if (!verification.ok) {
    return NextResponse.json({ error: "World ID could not verify that proof. Please try again." }, { status: 400 });
  }

  const linked = await linkNullifier(db, creator.id, verification.nullifierHex);
  if (!linked.ok) return NextResponse.json({ error: ALREADY_LINKED_MESSAGE }, { status: 409 });
  return NextResponse.json({ ok: true });
}
