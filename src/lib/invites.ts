import { and, count, desc, eq, gte, isNull, or } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import type { Db } from "@/lib/db/client";
import { parseIstLocal } from "@/lib/calendar";
import { creators, guests, type Invite, type InviteAnswer, invites, type TimeSlot } from "@/lib/db/schema";
import { getGuest, NotFoundError, setGuestStatus } from "@/lib/guests";
import type { PipelineEvent } from "@/lib/pipeline";
import { istDayStart, nextIstMidnight } from "@/lib/time";

export const DAILY_INVITE_LIMIT = 5;
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const newCode = customAlphabet(CODE_ALPHABET, 12);
const MAX_MESSAGE = 1200;
const MAX_ANGLE = 200;
const MAX_TIME_OPTIONS = 3;
const MAX_PLACE = 80;

/** A slot as the creator typed it: a datetime-local value in India time, and an optional place. */
export type SlotInput = { start: string; place?: string };
export type NewInvite = { guestId: string; message: string; angle: string; timeOptions: SlotInput[] };
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
  const timeOptions = i.timeOptions
    .flatMap((slot): TimeSlot[] => {
      const start = parseIstLocal(slot.start.trim());
      if (!start) return [];
      const place = slot.place?.trim().slice(0, MAX_PLACE);
      return [{ start: start.toISOString(), ...(place ? { place } : {}) }];
    })
    .slice(0, MAX_TIME_OPTIONS);

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

export type InviteCard = {
  code: string;
  /** Server-side only: lets the card page recognise the creator. Never sent to the browser. */
  creatorId: string;
  message: string;
  angle: string;
  timeOptions: TimeSlot[];
  chosenSlot: number | null;
  showName: string;
  showPitch?: string;
  creatorName: string;
  creatorPhotoUrl?: string;
  verified: boolean;
  guestName: string;
  openedAt: Date | null;
  answer?: InviteAnswer;
  answerNote?: string;
  /** Who claimed the invite by answering it. Shown to the creator only. */
  answeredBy?: Responder;
};

const MAX_ANSWER_NOTE = 500;

const ANSWER_EVENT: Record<InviteAnswer, PipelineEvent> = {
  accepted: "answered_accepted",
  time_suggested: "answered_time",
  declined: "answered_declined",
};

async function findInvite(db: Db, code: string) {
  const [row] = await db
    .select({ invite: invites, creator: creators, guestName: guests.name })
    .from(invites)
    .innerJoin(creators, eq(invites.creatorId, creators.id))
    .innerJoin(guests, eq(invites.guestId, guests.id))
    .where(eq(invites.code, code))
    .limit(1);
  return row ?? null;
}

/** The public card a guest sees. Only what the creator chose to send, plus the verified flag. */
export async function getInviteByCode(db: Db, code: string): Promise<InviteCard | null> {
  const row = await findInvite(db, code);
  if (!row) return null;
  const { invite, creator, guestName } = row;
  return {
    code: invite.code,
    creatorId: invite.creatorId,
    message: invite.message,
    angle: invite.angle,
    timeOptions: invite.timeOptions,
    chosenSlot: invite.chosenSlot,
    showName: creator.showName ?? `${creator.name}'s show`,
    ...(creator.showPitch ? { showPitch: creator.showPitch } : {}),
    creatorName: creator.name,
    ...(creator.photoUrl ? { creatorPhotoUrl: creator.photoUrl } : {}),
    verified: Boolean(creator.verifiedAt),
    guestName,
    openedAt: invite.openedAt,
    ...(invite.answer ? { answer: invite.answer } : {}),
    ...(invite.answerNote ? { answerNote: invite.answerNote } : {}),
    ...(invite.answeredByTelegramId !== null
      ? {
          answeredBy: {
            telegramId: invite.answeredByTelegramId,
            name: invite.answeredByName ?? "Someone",
            ...(invite.answeredByUsername ? { username: invite.answeredByUsername } : {}),
          },
        }
      : {}),
  };
}

/** Records the first time someone other than the creator opens the card. */
export async function markOpened(db: Db, code: string, viewerCreatorId: string | null, now: Date = new Date()): Promise<void> {
  const row = await findInvite(db, code);
  if (!row || row.invite.creatorId === viewerCreatorId || row.invite.openedAt) return;
  await db.update(invites).set({ openedAt: now }).where(and(eq(invites.id, row.invite.id), isNull(invites.openedAt)));
  await setGuestStatus(db, row.invite.creatorId, row.invite.guestId, "invite_opened");
}

/** The Telegram account answering an invite. */
export type Responder = { telegramId: number; name: string; username?: string };

export type AnswerResult = { ok: true; card: InviteCard } | { ok: false; reason: "not_found" | "claimed" | "own_invite" };

/**
 * Records a guest's answer. The first Telegram account to answer claims the invite: after that only it can
 * change the answer, so a forwarded link can't be answered by someone else. The creator can't answer their own.
 */
export async function recordAnswer(
  db: Db,
  code: string,
  a: { answer: InviteAnswer; note?: string; slot?: number },
  responder: Responder,
): Promise<AnswerResult> {
  const row = await findInvite(db, code);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.creator.telegramId === responder.telegramId) return { ok: false, reason: "own_invite" };
  const claimedBy = row.invite.answeredByTelegramId;
  if (claimedBy !== null && claimedBy !== responder.telegramId) return { ok: false, reason: "claimed" };
  const note = a.note?.trim().slice(0, MAX_ANSWER_NOTE) || null;
  // A slot only counts for a yes, and only if it is one the creator offered.
  const slot = a.slot;
  const chosenSlot =
    a.answer === "accepted" && Number.isInteger(slot) && slot !== undefined && slot >= 0 && slot < row.invite.timeOptions.length ? slot : null;
  const claimed = await db
    .update(invites)
    .set({
      answer: a.answer,
      answerNote: note,
      answeredAt: new Date(),
      chosenSlot,
      answeredByTelegramId: responder.telegramId,
      answeredByName: responder.name,
      answeredByUsername: responder.username ?? null,
    })
    // Guarded write: two people answering at once can't both claim it.
    .where(
      and(
        eq(invites.id, row.invite.id),
        or(isNull(invites.answeredByTelegramId), eq(invites.answeredByTelegramId, responder.telegramId)),
      ),
    )
    .returning({ id: invites.id });
  if (claimed.length === 0) return { ok: false, reason: "claimed" };
  await setGuestStatus(db, row.invite.creatorId, row.invite.guestId, ANSWER_EVENT[a.answer]);
  const card = await getInviteByCode(db, code);
  return card ? { ok: true, card } : { ok: false, reason: "not_found" };
}
