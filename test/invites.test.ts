import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { creators, guests } from "@/lib/db/schema";
import { createEpisode } from "@/lib/episodes";
import { addGuest } from "@/lib/guests";
import { createInvite, getInviteByCode, invitesLeftToday, listInvitesForGuest, markOpened, recordAnswer } from "@/lib/invites";
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
  timeOptions: [{ start: "2026-10-31T11:00", place: "Terrace, Circle CoWork" }, { start: "2026-11-01T16:00" }],
});

describe("createInvite", () => {
  it("lets a creator who has not verified with World ID send invites too; the card just has no verified badge", async () => {
    const { db, creator, guest } = await setup({ verified: false });
    const result = await createInvite(db, creator.id, draft(guest.id), NOON_IST);
    expect(result.ok).toBe(true);
    if (result.ok) expect((await getInviteByCode(db, result.invite.code))?.verified).toBe(false);
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

  it("stores time slots as UTC instants read from India time, with an optional place", async () => {
    const { db, creator, guest } = await setup();
    const result = await createInvite(db, creator.id, draft(guest.id), NOON_IST);
    expect(result.ok && result.invite.timeOptions).toEqual([
      { start: "2026-10-31T05:30:00.000Z", place: "Terrace, Circle CoWork" },
      { start: "2026-11-01T10:30:00.000Z" },
    ]);
  });

  it("keeps at most 3 valid slots, drops unreadable times, and caps the place at 80 characters", async () => {
    const { db, creator, guest } = await setup();
    const slots = [
      { start: "not a time" },
      { start: "2026-10-31T09:00", place: "x".repeat(100) },
      { start: "2026-10-31T10:00" },
      { start: "2026-10-31T11:00" },
      { start: "2026-10-31T12:00" },
    ];
    const result = await createInvite(db, creator.id, { ...draft(guest.id), timeOptions: slots }, NOON_IST);
    expect(result.ok && result.invite.timeOptions.map((s) => s.start)).toEqual([
      "2026-10-31T03:30:00.000Z",
      "2026-10-31T04:30:00.000Z",
      "2026-10-31T05:30:00.000Z",
    ]);
    expect(result.ok && result.invite.timeOptions[0].place).toHaveLength(80);
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

describe("guest invite card", () => {
  async function invited() {
    const ctx = await setup();
    const result = await createInvite(ctx.db, ctx.creator.id, draft(ctx.guest.id), NOON_IST);
    if (!result.ok) throw new Error("setup failed");
    return { ...ctx, code: result.invite.code };
  }
  const status = async (db: Awaited<ReturnType<typeof setup>>["db"], id: string) =>
    (await db.select().from(guests).where(eq(guests.id, id)))[0].status;

  it("returns null for an unknown code", async () => {
    const { db } = await setup();
    expect(await getInviteByCode(db, "nope-nope-no")).toBeNull();
  });

  it("shows the card with the creator's show and a verified badge", async () => {
    const { db, code } = await invited();
    expect(await getInviteByCode(db, code)).toMatchObject({
      code,
      showName: "In Between",
      creatorName: "Varun",
      guestName: "Arun",
      verified: true,
      message: "Hi Arun, would you come on In Between?",
      timeOptions: [{ start: "2026-10-31T05:30:00.000Z", place: "Terrace, Circle CoWork" }, { start: "2026-11-01T10:30:00.000Z" }],
      chosenSlot: null,
    });
  });

  it("offers the creator's booking link when the invite has no fixed times", async () => {
    const ctx = await setup();
    await ctx.db.update(creators).set({ schedulingUrl: "https://calendly.com/me/30min" }).where(eq(creators.id, ctx.creator.id));
    const open = await createInvite(ctx.db, ctx.creator.id, { ...draft(ctx.guest.id), timeOptions: [] }, NOON_IST);
    const fixed = await createInvite(ctx.db, ctx.creator.id, draft(ctx.guest.id), new Date(NOON_IST.getTime() + 1000));
    if (!open.ok || !fixed.ok) throw new Error("setup failed");
    expect((await getInviteByCode(ctx.db, open.invite.code))?.schedulingUrl).toBe("https://calendly.com/me/30min");
    // Fixed times win: the guest picks one of those instead.
    expect((await getInviteByCode(ctx.db, fixed.invite.code))?.schedulingUrl).toBeUndefined();
  });

  it("does not count the creator opening their own link", async () => {
    const { db, creator, guest, code } = await invited();
    await markOpened(db, code, creator.id);
    expect((await getInviteByCode(db, code))?.openedAt).toBeNull();
    expect(await status(db, guest.id)).toBe("invited");
  });

  it("records the first open by someone else, and keeps that time", async () => {
    const { db, guest, code } = await invited();
    const first = new Date("2026-10-30T07:00:00Z");
    await markOpened(db, code, null, first);
    await markOpened(db, code, null, new Date("2026-10-30T08:00:00Z"));
    expect((await getInviteByCode(db, code))?.openedAt?.toISOString()).toBe(first.toISOString());
    expect(await status(db, guest.id)).toBe("opened");
  });

  const arun = { telegramId: 5001, name: "Arun Philips", username: "arunphilips" };
  const stranger = { telegramId: 5002, name: "Someone Else" };
  const card = async (p: ReturnType<typeof recordAnswer>) => {
    const r = await p;
    if (!r.ok) throw new Error(r.reason);
    return r.card;
  };

  it("records an answer and lets the guest change their mind", async () => {
    const { db, guest, code } = await invited();
    expect((await card(recordAnswer(db, code, { answer: "accepted" }, arun))).answer).toBe("accepted");
    expect(await status(db, guest.id)).toBe("accepted");
    await recordAnswer(db, code, { answer: "declined", note: "Travelling, sorry" }, arun);
    expect(await status(db, guest.id)).toBe("declined");
    expect(await getInviteByCode(db, code)).toMatchObject({ answer: "declined", answerNote: "Travelling, sorry" });
  });

  it("records who answered, from their Telegram login", async () => {
    const { db, code } = await invited();
    await recordAnswer(db, code, { answer: "accepted" }, arun);
    expect(await getInviteByCode(db, code)).toMatchObject({
      answeredBy: { telegramId: 5001, name: "Arun Philips", username: "arunphilips" },
    });
  });

  it("lets only the first person to answer change the answer", async () => {
    const { db, guest, code } = await invited();
    await recordAnswer(db, code, { answer: "accepted" }, arun);
    expect(await recordAnswer(db, code, { answer: "declined" }, stranger)).toEqual({ ok: false, reason: "claimed" });
    expect(await status(db, guest.id)).toBe("accepted");
  });

  it("refuses the creator answering their own invite", async () => {
    const { db, code, creator } = await invited();
    expect(await recordAnswer(db, code, { answer: "accepted" }, { telegramId: creator.telegramId, name: "Varun" })).toEqual({
      ok: false,
      reason: "own_invite",
    });
  });

  it("records which time slot the guest picked when they say yes", async () => {
    const { db, code } = await invited();
    expect((await card(recordAnswer(db, code, { answer: "accepted", slot: 1 }, arun))).chosenSlot).toBe(1);
  });

  it("ignores a slot that doesn't exist, and clears the slot when the guest declines", async () => {
    const { db, code } = await invited();
    expect((await card(recordAnswer(db, code, { answer: "accepted", slot: 7 }, arun))).chosenSlot).toBeNull();
    await recordAnswer(db, code, { answer: "accepted", slot: 0 }, arun);
    expect((await card(recordAnswer(db, code, { answer: "declined" }, arun))).chosenSlot).toBeNull();
  });

  it("limits the answer note to 500 characters", async () => {
    const { db, code } = await invited();
    const answered = await card(recordAnswer(db, code, { answer: "time_suggested", note: "n".repeat(900) }, arun));
    expect(answered.answerNote).toHaveLength(500);
  });

  it("reports not_found when answering an unknown code", async () => {
    const { db } = await setup();
    expect(await recordAnswer(db, "nope-nope-no", { answer: "accepted" }, arun)).toEqual({ ok: false, reason: "not_found" });
  });

  it("shows no verified badge when the creator is not verified", async () => {
    const { db, creator, code } = await invited();
    await db.update(creators).set({ verifiedAt: null }).where(eq(creators.id, creator.id));
    expect((await getInviteByCode(db, code))?.verified).toBe(false);
  });
});
