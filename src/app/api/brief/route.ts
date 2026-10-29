import { NextResponse } from "next/server";
import { z } from "zod";
import { getModel } from "@/lib/ai/model";
import { currentCreator } from "@/lib/auth/session";
import { buildBrief, saveBrief } from "@/lib/brief";
import { getDb } from "@/lib/db/client";
import { getGuest, setGuestStatus } from "@/lib/guests";
import { checkRateLimit } from "@/lib/ratelimit";
import { tinyfishFetch, tinyfishSearch } from "@/lib/tinyfish";

export const maxDuration = 60;

const body = z.object({ guestId: z.uuid() });

export async function POST(request: Request) {
  const db = getDb();
  const creator = await currentCreator(db);
  if (!creator) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown guest." }, { status: 400 });
  const guest = await getGuest(db, creator.id, parsed.data.guestId);
  if (!guest) return NextResponse.json({ error: "Unknown guest." }, { status: 404 });

  const limit = await checkRateLimit(db, `brief:${creator.id}`, 20, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `You've built a lot of briefs this hour. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.` },
      { status: 429 },
    );
  }

  try {
    const brief = await buildBrief(
      {
        name: guest.name,
        links: guest.links,
        topic: guest.episodeTopic,
        showName: creator.showName ?? "my show",
        lookingToMeet: guest.lookingToMeet ?? undefined,
      },
      { search: tinyfishSearch, fetchPages: tinyfishFetch, model: getModel() },
    );
    await saveBrief(db, guest.id, brief);
    await setGuestStatus(db, creator.id, guest.id, "brief_built");
    return NextResponse.json(brief);
  } catch (error) {
    console.error("brief failed", error);
    return NextResponse.json({ error: "Research failed just now. Please try again in a minute." }, { status: 502 });
  }
}
