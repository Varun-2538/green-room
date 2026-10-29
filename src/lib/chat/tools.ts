import { type LanguageModel, tool, type ToolSet } from "ai";
import { z } from "zod";
import { type Brief, buildBrief, getLatestBrief, saveBrief } from "@/lib/brief";
import type { Db } from "@/lib/db/client";
import type { Creator } from "@/lib/db/schema";
import { getGuest, listAllGuests, setGuestStatus } from "@/lib/guests";
import { draftInvite } from "@/lib/invite-draft";
import { DAILY_INVITE_LIMIT, invitesLeftToday } from "@/lib/invites";
import type { tinyfishFetch, tinyfishSearch } from "@/lib/tinyfish";

export type DeskToolContext = {
  db: Db;
  creator: Creator;
  model: LanguageModel;
  search: typeof tinyfishSearch;
  fetchPages: typeof tinyfishFetch;
};

const NOT_FOUND = { error: "not_found" } as const;
const guestId = z.uuid().describe("The guest's id from list_pipeline");

/**
 * The desk assistant's tools. Every tool is scoped to the signed-in creator, and none of them
 * can create or send an invite: that needs the creator's own click on the invite builder.
 */
export function deskTools(ctx: DeskToolContext) {
  const { db, creator } = ctx;
  const showName = creator.showName ?? "my show";

  async function briefFor(id: string): Promise<Brief | null> {
    const guest = await getGuest(db, creator.id, id);
    if (!guest) return null;
    const existing = await getLatestBrief(db, guest.id);
    if (existing) return existing;
    const brief = await buildBrief(
      { name: guest.name, links: guest.links, topic: guest.episodeTopic, showName, lookingToMeet: guest.lookingToMeet ?? undefined },
      { search: ctx.search, fetchPages: ctx.fetchPages, model: ctx.model },
    );
    await saveBrief(db, guest.id, brief);
    await setGuestStatus(db, creator.id, guest.id, "brief_built");
    return brief;
  }

  return {
    list_pipeline: tool({
      description: "List every guest on the creator's desk with their id, episode and booking status.",
      inputSchema: z.object({}),
      execute: async () => ({
        guests: (await listAllGuests(db, creator.id)).map((g) => ({
          id: g.id,
          name: g.name,
          status: g.status,
          episode: g.episodeTopic,
        })),
      }),
    }),

    get_brief: tool({
      description: "Get a guest's research brief (story, sourced facts, recent work, questions). Builds one with web research if missing.",
      inputSchema: z.object({ guestId }),
      execute: async (input) => (await briefFor(input.guestId)) ?? NOT_FOUND,
    }),

    draft_invite: tool({
      description: "Draft an invite message and episode angle for a guest. This does NOT send or create the invite.",
      inputSchema: z.object({
        guestId,
        tone: z.enum(["warm", "brief", "playful"]),
        note: z.string().max(500).optional().describe("Something the creator wants mentioned"),
      }),
      execute: async (input) => {
        const guest = await getGuest(db, creator.id, input.guestId);
        if (!guest) return NOT_FOUND;
        const draft = await draftInvite(
          {
            showName,
            showPitch: creator.showPitch ?? undefined,
            creatorName: creator.name,
            guestName: guest.name,
            brief: await getLatestBrief(db, guest.id),
            lookingToMeet: guest.lookingToMeet ?? undefined,
            tone: input.tone,
            note: input.note,
          },
          { model: ctx.model },
        );
        await setGuestStatus(db, creator.id, guest.id, "invite_drafted");
        return draft;
      },
    }),

    set_status: tool({
      description: "Mark a guest's episode as recorded, after the recording happened.",
      inputSchema: z.object({ guestId, event: z.literal("marked_recorded") }),
      execute: async (input) => {
        if (input.event !== "marked_recorded") return { error: "invalid_event" } as const;
        const guest = await getGuest(db, creator.id, input.guestId);
        if (!guest) return NOT_FOUND;
        const updated = await setGuestStatus(db, creator.id, guest.id, "marked_recorded");
        return { status: updated.status };
      },
    }),

    invites_left: tool({
      description: "How many verified invites the creator can still create today (India time).",
      inputSchema: z.object({}),
      execute: async () => ({ left: await invitesLeftToday(db, creator.id), limit: DAILY_INVITE_LIMIT }),
    }),
  } satisfies ToolSet;
}
