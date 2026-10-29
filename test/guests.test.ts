import { describe, expect, it } from "vitest";
import { creators } from "@/lib/db/schema";
import { createEpisode, listEpisodes } from "@/lib/episodes";
import { addGuest, getGuest, listGuests, NotFoundError, setGuestStatus } from "@/lib/guests";
import { makeTestDb } from "./helpers/db";

async function setup() {
  const db = await makeTestDb();
  const [owner] = await db.insert(creators).values({ telegramId: 1, name: "Varun" }).returning();
  const [other] = await db.insert(creators).values({ telegramId: 2, name: "Other" }).returning();
  const episode = await createEpisode(db, owner.id, "  People who quit a safe path  ");
  return { db, owner, other, episode };
}

const arun = { name: "Arun", links: ["https://arun.blog"], lookingToMeet: "storytellers" };

describe("episodes", () => {
  it("trims the topic", async () => {
    const { episode } = await setup();
    expect(episode.topic).toBe("People who quit a safe path");
  });

  it("rejects a topic shorter than 3 characters", async () => {
    const { db, owner } = await setup();
    await expect(createEpisode(db, owner.id, " a ")).rejects.toThrow(/topic/i);
  });

  it("lists only the creator's episodes with guest counts", async () => {
    const { db, owner, other, episode } = await setup();
    await createEpisode(db, other.id, "Someone else's show");
    await addGuest(db, owner.id, episode.id, arun);
    const list = await listEpisodes(db, owner.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: episode.id, guestCount: 1 });
  });
});

describe("guests", () => {
  it("adds a guest as shortlisted", async () => {
    const { db, owner, episode } = await setup();
    const guest = await addGuest(db, owner.id, episode.id, arun);
    expect(guest).toMatchObject({ name: "Arun", status: "shortlisted", links: ["https://arun.blog"] });
    expect(await listGuests(db, owner.id, episode.id)).toHaveLength(1);
  });

  it("refuses to add a guest to another creator's episode", async () => {
    const { db, other, episode } = await setup();
    await expect(addGuest(db, other.id, episode.id, arun)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hides a guest from another creator", async () => {
    const { db, owner, other, episode } = await setup();
    const guest = await addGuest(db, owner.id, episode.id, arun);
    expect(await getGuest(db, other.id, guest.id)).toBeNull();
    expect((await getGuest(db, owner.id, guest.id))?.id).toBe(guest.id);
  });

  it("moves status through the pipeline", async () => {
    const { db, owner, episode } = await setup();
    const guest = await addGuest(db, owner.id, episode.id, arun);
    const updated = await setGuestStatus(db, owner.id, guest.id, "brief_built");
    expect(updated.status).toBe("brief_ready");
  });

  it("refuses to change another creator's guest", async () => {
    const { db, owner, other, episode } = await setup();
    const guest = await addGuest(db, owner.id, episode.id, arun);
    await expect(setGuestStatus(db, other.id, guest.id, "brief_built")).rejects.toBeInstanceOf(NotFoundError);
  });
});
