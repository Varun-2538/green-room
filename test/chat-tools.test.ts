import { describe, expect, it, vi } from "vitest";
import { saveBrief } from "@/lib/brief";
import { deskTools, type DeskToolContext } from "@/lib/chat/tools";
import { creators, invites } from "@/lib/db/schema";
import { createEpisode } from "@/lib/episodes";
import { addGuest, getGuest } from "@/lib/guests";
import { mockJsonModel } from "./helpers/ai";
import { makeTestDb } from "./helpers/db";

const opts = { toolCallId: "t1", messages: [] } as never;
const OTHER_GUEST = "00000000-0000-4000-8000-000000000000";

async function setup(modelAnswers: unknown[] = [{ message: "Hi Arun", angle: "Dreams" }]) {
  const db = await makeTestDb();
  const [creator] = await db
    .insert(creators)
    .values({ telegramId: 1, name: "Varun", showName: "In Between", verifiedAt: new Date(), nullifier: "10" })
    .returning();
  const episode = await createEpisode(db, creator.id, "Dreams and detours");
  const guest = await addGuest(db, creator.id, episode.id, { name: "Arun", links: ["https://arun.example"] });
  const ai = mockJsonModel(...modelAnswers);
  const search = vi.fn(async () => []);
  const fetchPages = vi.fn(async () => ({ pages: [{ url: "https://arun.example", finalUrl: "https://arun.example", text: "dreams" }], failed: [] }));
  const ctx: DeskToolContext = { db, creator, model: ai.model, search, fetchPages };
  return { db, creator, guest, ctx, search, ai, tools: deskTools(ctx) };
}

describe("deskTools", () => {
  it("lists the creator's pipeline", async () => {
    const { tools } = await setup();
    const out = await tools.list_pipeline.execute!({}, opts);
    expect(out).toMatchObject({ guests: [{ name: "Arun", status: "shortlisted", episode: "Dreams and detours" }] });
  });

  it.each(["get_brief", "draft_invite", "set_status"] as const)("%s refuses a guest the creator doesn't own", async (name) => {
    const { tools } = await setup();
    const input = { guestId: OTHER_GUEST, tone: "warm", event: "marked_recorded" };
    expect(await tools[name].execute!(input as never, opts)).toEqual({ error: "not_found" });
  });

  it("get_brief returns a saved brief without researching again", async () => {
    const { db, guest, tools, search } = await setup();
    await saveBrief(db, guest.id, { story: "saved", recentWork: [], questions: [], facts: [], limited: false, sources: [] });
    expect(await tools.get_brief.execute!({ guestId: guest.id }, opts)).toMatchObject({ story: "saved" });
    expect(search).not.toHaveBeenCalled();
  });

  it("get_brief researches and saves when there is no brief", async () => {
    const answer = { story: "fresh", recentWork: [], questions: ["Q?"], facts: [] };
    const { db, creator, guest, tools, search } = await setup([answer]);
    expect(await tools.get_brief.execute!({ guestId: guest.id }, opts)).toMatchObject({ story: "fresh" });
    expect(search).toHaveBeenCalledOnce();
    expect((await getGuest(db, creator.id, guest.id))?.status).toBe("brief_ready");
  });

  it("draft_invite only drafts: no invite is created", async () => {
    const { db, creator, guest, tools } = await setup();
    expect(await tools.draft_invite.execute!({ guestId: guest.id, tone: "warm" }, opts)).toEqual({ message: "Hi Arun", angle: "Dreams" });
    expect(await db.select().from(invites)).toHaveLength(0);
    expect((await getGuest(db, creator.id, guest.id))?.status).toBe("drafted");
  });

  it("set_status refuses any event except marked_recorded", async () => {
    const { guest, tools } = await setup();
    expect(await tools.set_status.execute!({ guestId: guest.id, event: "answered_accepted" } as never, opts)).toEqual({ error: "invalid_event" });
  });

  it("invites_left reports today's remaining invites", async () => {
    const { tools } = await setup();
    expect(await tools.invites_left.execute!({}, opts)).toEqual({ left: 5, limit: 5 });
  });
});

describe("deskTools scoped to one guest (the guest page chat)", () => {
  it("uses the page's guest when the model leaves guestId out", async () => {
    const { db, guest, ctx } = await setup();
    await saveBrief(db, guest.id, { story: "scoped", recentWork: [], questions: [], facts: [], limited: false, sources: [] });
    const tools = deskTools({ ...ctx, guestId: guest.id });
    expect(await tools.get_brief.execute!({} as never, opts)).toMatchObject({ story: "scoped" });
  });

  it("still refuses another creator's guest even when scoped", async () => {
    const { ctx } = await setup();
    const tools = deskTools({ ...ctx, guestId: OTHER_GUEST });
    expect(await tools.get_brief.execute!({} as never, opts)).toEqual({ error: "not_found" });
  });

  it("tells the model the guest id is optional on a guest page", async () => {
    const { guest, ctx } = await setup();
    const schema = deskTools({ ...ctx, guestId: guest.id }).get_brief.inputSchema as unknown as { safeParse: (v: unknown) => { success: boolean } };
    expect(schema.safeParse({}).success).toBe(true);
  });
});
