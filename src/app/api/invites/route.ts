import { NextResponse } from "next/server";
import { z } from "zod";
import { getModel } from "@/lib/ai/model";
import { currentCreator } from "@/lib/auth/session";
import { getLatestBrief } from "@/lib/brief";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { getGuest, setGuestStatus } from "@/lib/guests";
import { draftInvite } from "@/lib/invite-draft";
import { createInvite, DAILY_INVITE_LIMIT } from "@/lib/invites";
import { checkRateLimit } from "@/lib/ratelimit";
import { formatIstTime } from "@/lib/time";

export const maxDuration = 60;

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("draft"),
    guestId: z.uuid(),
    tone: z.enum(["warm", "brief", "playful"]),
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("create"),
    guestId: z.uuid(),
    message: z.string().min(1).max(2000),
    angle: z.string().max(400),
    timeOptions: z.array(z.string().max(200)).max(10),
  }),
]);

export async function POST(request: Request) {
  const db = getDb();
  const creator = await currentCreator(db);
  if (!creator) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That request didn't look right." }, { status: 400 });
  const input = parsed.data;

  const guest = await getGuest(db, creator.id, input.guestId);
  if (!guest) return NextResponse.json({ error: "Unknown guest." }, { status: 404 });

  if (input.action === "draft") {
    const limit = await checkRateLimit(db, `draft:${creator.id}`, 30, 3600);
    if (!limit.allowed) return NextResponse.json({ error: "Too many drafts this hour. Try again shortly." }, { status: 429 });
    try {
      const draft = await draftInvite(
        {
          showName: creator.showName ?? "my show",
          showPitch: creator.showPitch ?? undefined,
          creatorName: creator.name,
          guestName: guest.name,
          brief: await getLatestBrief(db, guest.id),
          lookingToMeet: guest.lookingToMeet ?? undefined,
          tone: input.tone,
          note: input.note,
        },
        { model: getModel() },
      );
      await setGuestStatus(db, creator.id, guest.id, "invite_drafted");
      return NextResponse.json(draft);
    } catch (error) {
      console.error("draft failed", error);
      return NextResponse.json({ error: "Drafting failed just now. Please try again." }, { status: 502 });
    }
  }

  const result = await createInvite(db, creator.id, {
    guestId: guest.id,
    message: input.message,
    angle: input.angle,
    timeOptions: input.timeOptions,
  });
  if (!result.ok) {
    if (result.reason === "not_verified") {
      return NextResponse.json({ error: "Verify with World ID first.", verify: true }, { status: 403 });
    }
    return NextResponse.json(
      { error: `You've sent ${DAILY_INVITE_LIMIT} invites today. More at ${formatIstTime(result.resetsAt)} IST.` },
      { status: 429 },
    );
  }
  return NextResponse.json({ url: `${env.NEXT_PUBLIC_APP_URL}/i/${result.invite.code}` });
}
