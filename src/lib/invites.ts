import { and, count, desc, eq, gte } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import type { Db } from "@/lib/db/client";
import { creators, type Invite, invites } from "@/lib/db/schema";
import { getGuest, NotFoundError, setGuestStatus } from "@/lib/guests";
import { istDayStart, nextIstMidnight } from "@/lib/time";

export const DAILY_INVITE_LIMIT = 5;
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const newCode = customAlphabet(CODE_ALPHABET, 12);
const MAX_MESSAGE = 1200;
const MAX_ANGLE = 200;
const MAX_TIME_OPTIONS = 3;
const MAX_TIME_OPTION = 80;

export type NewInvite = { guestId: string; message: string; angle: string; timeOptions: string[] };
export type CreateInviteResult =
  | { ok: true; invite: Invite }
  | { ok: false; reason: "not_verified" }
  | { ok: false; reason: "limit_reached"; resetsAt: Date };

async function sentToday(db: Db, creatorId: string, now: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(invites)
    .where(and(eq(invites.creatorId, creatorId), gte(invites.createdAt, istDayStart(now))));
  return row.n;
}

export async function invitesLeftToday(db: Db, creatorId: string, now: Date = new Date()): Promise<number> {
  return Math.max(0, DAILY_INVITE_LIMIT - (await sentToday(db, creatorId, now)));
}

/**
 * Issues a verified invite link. One World ID is tied to one account (see linkNullifier),
 * so the per-account daily limit is a per-human limit.
 */
export async function createInvite(db: Db, creatorId: string, i: NewInvite, now: Date = new Date()): Promise<CreateInviteResult> {
  const message = i.message.trim().slice(0, MAX_MESSAGE);
  if (!message) throw new Error("Invite message is empty");
  const angle = i.angle.trim().slice(0, MAX_ANGLE);
  const timeOptions = i.timeOptions.map((t) => t.trim()).filter((t) => t && t.length <= MAX_TIME_OPTION).slice(0, MAX_TIME_OPTIONS);

  const guest = await getGuest(db, creatorId, i.guestId);
  if (!guest) throw new NotFoundError("Guest");

  return db.transaction(async (tx) => {
    // Lock the creator row so two simultaneous clicks can't both pass the limit check.
    const [creator] = await tx
      .select({ verifiedAt: creators.verifiedAt })
      .from(creators)
      .where(eq(creators.id, creatorId))
      .for("update");
    if (!creator?.verifiedAt) return { ok: false, reason: "not_verified" } as const;

    if ((await sentToday(tx as unknown as Db, creatorId, now)) >= DAILY_INVITE_LIMIT) {
      return { ok: false, reason: "limit_reached", resetsAt: nextIstMidnight(now) } as const;
    }

    const [invite] = await tx
      .insert(invites)
      .values({ guestId: guest.id, creatorId, code: newCode(), message, angle, timeOptions, createdAt: now })
      .returning();
    await setGuestStatus(tx as unknown as Db, creatorId, guest.id, "invite_created");
    return { ok: true, invite } as const;
  });
}



export async function listInvitesForGuest(db: Db, creatorId: string, guestId: string): Promise<Invite[]> {
  return db
    .select()
    .from(invites)
    .where(and(eq(invites.creatorId, creatorId), eq(invites.guestId, guestId)))
    .orderBy(desc(invites.createdAt));
}
