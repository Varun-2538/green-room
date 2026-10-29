import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { recordAnswer } from "@/lib/invites";
import { checkRateLimit } from "@/lib/ratelimit";

const body = z.object({
  answer: z.enum(["accepted", "time_suggested", "declined"]),
  note: z.string().max(2000).optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/i/[code]/answer">) {
  const { code } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{12}$/.test(code)) return NextResponse.json({ error: "Unknown invite." }, { status: 404 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please pick an answer." }, { status: 400 });

  const db = getDb();
  const limit = await checkRateLimit(db, `answer:${code}`, 10, 3600);
  if (!limit.allowed) return NextResponse.json({ error: "Too many changes. Try again later." }, { status: 429 });

  const card = await recordAnswer(db, code, parsed.data);
  if (!card) return NextResponse.json({ error: "Unknown invite." }, { status: 404 });
  return NextResponse.json({ answer: card.answer, answerNote: card.answerNote ?? null });
}
