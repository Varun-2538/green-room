import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { loadChat, saveChat } from "@/lib/chat/history";
import { creators } from "@/lib/db/schema";
import { createEpisode } from "@/lib/episodes";
import { addGuest } from "@/lib/guests";
import { makeTestDb } from "./helpers/db";

const msg = (id: string, role: "user" | "assistant", text: string): UIMessage => ({ id, role, parts: [{ type: "text", text }] });

async function setup() {
  const db = await makeTestDb();
  const [c] = await db.insert(creators).values({ telegramId: 1, name: "V" }).returning();
  const ep = await createEpisode(db, c.id, "Topic here");
  const g = await addGuest(db, c.id, ep.id, { name: "A", links: [] });
  return { db, creatorId: c.id, guestId: g.id };
}

describe("chat history", () => {
  it("saves and loads a conversation in order", async () => {
    const { db, creatorId } = await setup();
    const convo = [msg("1", "user", "who is waiting?"), msg("2", "assistant", "Arun opened it.")];
    await saveChat(db, creatorId, null, convo);
    expect(await loadChat(db, creatorId, null)).toEqual(convo);
  });

  it("replaces the stored conversation on each save", async () => {
    const { db, creatorId } = await setup();
    await saveChat(db, creatorId, null, [msg("1", "user", "a")]);
    await saveChat(db, creatorId, null, [msg("1", "user", "a"), msg("2", "assistant", "b")]);
    expect(await loadChat(db, creatorId, null)).toHaveLength(2);
  });

  it("keeps the desk chat and each guest chat separate", async () => {
    const { db, creatorId, guestId } = await setup();
    await saveChat(db, creatorId, null, [msg("1", "user", "desk")]);
    await saveChat(db, creatorId, guestId, [msg("9", "user", "guest")]);
    expect((await loadChat(db, creatorId, null)).map((m) => m.id)).toEqual(["1"]);
    expect((await loadChat(db, creatorId, guestId)).map((m) => m.id)).toEqual(["9"]);
  });

  it("keeps only the last 30 messages", async () => {
    const { db, creatorId } = await setup();
    const many = Array.from({ length: 40 }, (_, i) => msg(String(i), i % 2 ? "assistant" : "user", `m${i}`));
    await saveChat(db, creatorId, null, many);
    const loaded = await loadChat(db, creatorId, null);
    expect(loaded).toHaveLength(30);
    expect(loaded[0].id).toBe("10");
  });
});

describe("forModel", () => {
  it("keeps what was said but drops earlier tool results, so every answer uses fresh data", async () => {
    const { forModel } = await import("@/lib/chat/history");
    const old = [
      { id: "1", role: "user", parts: [{ type: "text", text: "Who is in my pipeline?" }] },
      {
        id: "2",
        role: "assistant",
        parts: [
          { type: "step-start" },
          { type: "tool-list_pipeline", toolCallId: "c1", state: "output-available", input: {}, output: { guests: [{ name: "Arun", status: "shortlisted" }] } },
          { type: "text", text: "Arun is shortlisted." },
        ],
      },
      { id: "3", role: "assistant", parts: [{ type: "tool-list_pipeline", toolCallId: "c2", state: "output-available", input: {}, output: {} }] },
      { id: "4", role: "user", parts: [{ type: "text", text: "Who said yes?" }] },
    ] as unknown as import("ai").UIMessage[];
    expect(forModel(old)).toEqual([
      old[0],
      { id: "2", role: "assistant", parts: [{ type: "text", text: "Arun is shortlisted." }] },
      old[3],
    ]);
  });
});
