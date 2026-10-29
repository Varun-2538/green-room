import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { creators, guests } from "@/lib/db/schema";
import { createEpisode } from "@/lib/episodes";
import { addGuest } from "@/lib/guests";
import { createInvite, invitesLeftToday, listInvitesForGuest } from "@/lib/invites";
import { makeTestDb } from "./helpers/db";

const NOON_IST = new Date("2026-10-30T06:30:00Z");

async function setup({ verified = true } = {}) {
  const db = await makeTestDb();
  const [creator] = await db
    .insert(creators)
    .values({ telegramId: 1, name: "Varun", showName: "In Between", verifiedAt: verified ? new Date() : null, nullifier: verified ? "10" : null })
    .returning();
  const episode = await createEpisode(db, creator.id, "Quitting safe paths");
  const guest = await addGuest(db, creator.id, episode.id, { name: "Arun", links: [] });
  return { db, creator, guest };
}

const draft = (guestId: string) => ({
  guestId,
  message: "Hi Arun, would you come on In Between?",
  angle: "Dreams and the road to them",
  timeOptions: ["Sat 11:00", "Sun 16:00"],
});

describe("createInvite", () => {
  it("refuses a creator who has not verified with World ID", async () => {
    const { db, creator, guest } = await setup({ verified: false });
    expect(await createInvite(db, creator.id, draft(guest.id), NOON_IST)).toEqual({ ok: false, reason: "not_verified" });
  });

  it("creates an invite with a 12-character URL-safe code and marks the guest invited", async () => {
    const { db, creator, guest } = await setup();
    const result = await createInvite(db, creator.id, draft(guest.id), NOON_IST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invite.code).toMatch(/^[A-Za-z0-9_-]{12}$/);
    const [g] = await db.select().from(guests).where(eq(guests.id, guest.id));
    expect(g.status).toBe("invited");
  });

  it("allows 5 invites in an IST day and refuses the 6th with the reset time", async () => {
    const { db, creator, guest } = await setup();
    for (let i = 0; i < 5; i++) {
      expect((await createInvite(db, creator.id, draft(guest.id), NOON_IST)).ok).toBe(true);
    }
    expect(await createInvite(db, creator.id, draft(guest.id), NOON_IST)).toEqual({
      ok: false,
      reason: "limit_reached",
      resetsAt: new Date("2026-10-30T18:30:00Z"),
    });
    expect(await invitesLeftToday(db, creator.id, NOON_IST)).toBe(0);
  });

  it("counts an invite at 00:05 IST toward the new day", async () => {
    const { db, creator, guest } = await setup();
    for (let i = 0; i < 5; i++) await createInvite(db, creator.id, draft(guest.id), NOON_IST);
    const justAfterMidnightIst = new Date("2026-10-30T18:35:00Z");
    expect((await createInvite(db, creator.id, draft(guest.id), justAfterMidnightIst)).ok).toBe(true);
    expect(await invitesLeftToday(db, creator.id, justAfterMidnightIst)).toBe(4);
  });

  it("keeps at most 3 time options of at most 80 characters", async () => {
    const { db, creator, guest } = await setup();
    const result = await createInvite(
      db,
      creator.id,
      { ...draft(guest.id), timeOptions: ["a", "b", "c", "d", "x".repeat(100)] },
      NOON_IST,
    );
    expect(result.ok && result.invite.timeOptions).toEqual(["a", "b", "c"]);
  });

  it("refuses to invite another creator's guest", async () => {
    const { db, guest } = await setup();
    const [other] = await db.insert(creators).values({ telegramId: 2, name: "O", verifiedAt: new Date(), nullifier: "11" }).returning();
    await expect(createInvite(db, other.id, draft(guest.id), NOON_IST)).rejects.toThrow(/not found/i);
  });

  it("refuses an empty message", async () => {
    const { db, creator, guest } = await setup();
    await expect(createInvite(db, creator.id, { ...draft(guest.id), message: "  " }, NOON_IST)).rejects.toThrow(/message/i);
  });
});

describe("listInvitesForGuest", () => {
  it("lists the guest's invites newest first, only for their creator", async () => {
    const { db, creator, guest } = await setup();
    await createInvite(db, creator.id, { ...draft(guest.id), angle: "first" }, NOON_IST);
    await createInvite(db, creator.id, { ...draft(guest.id), angle: "second" }, new Date(NOON_IST.getTime() + 1000));
    expect((await listInvitesForGuest(db, creator.id, guest.id)).map((i) => i.angle)).toEqual(["second", "first"]);
    expect(await listInvitesForGuest(db, "00000000-0000-4000-8000-000000000000", guest.id)).toEqual([]);
  });
});
