import { signRequest } from "@worldcoin/idkit-core/signing";
import { NextResponse } from "next/server";
import { currentCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { WORLD_ACTION } from "@/lib/worldid/verify";

export async function POST() {
  if (!(await currentCreator(getDb()))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex: env.RP_SIGNING_KEY,
    action: WORLD_ACTION,
  });
  return NextResponse.json({ sig, nonce, created_at: createdAt, expires_at: expiresAt });
}
