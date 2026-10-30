import { buildIcs } from "@/lib/calendar";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { inviteEvent } from "@/lib/invite-calendar";
import { getInviteByCode } from "@/lib/invites";

/** The .ics file for an accepted invite (Apple Calendar, Outlook, and anything else that opens calendar files). */
export async function GET(_request: Request, ctx: RouteContext<"/api/i/[code]/calendar">) {
  const { code } = await ctx.params;
  const card = /^[A-Za-z0-9_-]{12}$/.test(code) ? await getInviteByCode(getDb(), code) : null;
  const event = card ? inviteEvent(card, env.NEXT_PUBLIC_APP_URL) : null;
  if (!event) return new Response("No accepted time for this invite yet.", { status: 404 });

  return new Response(buildIcs(event), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="green-room-recording.ics"',
      "cache-control": "no-store",
    },
  });
}
