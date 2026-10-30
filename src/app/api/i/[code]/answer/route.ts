import { NextResponse } from "next/server";
import { z } from "zod";
import { currentCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { recordAnswer } from "@/lib/invites";
import { checkRateLimit } from "@/lib/ratelimit";

const body = z.object({
  answer: z.enum(["accepted", "time_suggested", "declined"]),
  note: z.string().max(2000).optional(),
  slot: z.number().int().min(0).max(10).optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/i/[code]/answer">) {
  const { code } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{12}$/.test(code)) return NextResponse.json({ error: "Unknown invite." }, { status: 404 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please pick an answer." }, { status: 400 });

  const db = getDb();
  const limit = await checkRateLimit(db, `answer:${code}`, 10, 3600);
  if (!limit.allowed) return NextResponse.json({ error: "Too many changes. Try again later." }, { status: 429 });

  const viewer = await currentCreator(db);
  if (!viewer) return NextResponse.json({ error: "Log in with Telegram to answer.", login: true }, { status: 401 });

  const result = await recordAnswer(db, code, parsed.data, {
    telegramId: viewer.telegramId,
    name: viewer.name,
    ...(viewer.username ? { username: viewer.username } : {}),
  });
  if (!result.ok) {
    const refusal = {
      not_found: ["Unknown invite.", 404],
      claimed: ["This invite has already been answered by someone else.", 409],
      own_invite: ["This is your own invite. Send the link to your guest.", 403],
    } as const;
    const [error, status] = refusal[result.reason];
    return NextResponse.json({ error }, { status });
  }
  const { card } = result;
  return NextResponse.json({ answer: card.answer, answerNote: card.answerNote ?? null, chosenSlot: card.chosenSlot });
}
