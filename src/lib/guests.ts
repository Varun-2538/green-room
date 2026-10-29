import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { episodes, type Guest, guests } from "@/lib/db/schema";
import { getEpisode } from "@/lib/episodes";
import { applyEvent, type PipelineEvent } from "@/lib/pipeline";

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

/** Public facts about a guest. Never anything from a Mosaic pair page. */
export type GuestInput = { name: string; links: string[]; lookingToMeet?: string; creatorNote?: string };

export type GuestWithEpisode = Guest & { episodeTopic: string };

export async function addGuest(db: Db, creatorId: string, episodeId: string, g: GuestInput): Promise<Guest> {
  if (!(await getEpisode(db, creatorId, episodeId))) throw new NotFoundError("Episode");
  const [row] = await db
    .insert(guests)
    .values({
      episodeId,
      name: g.name,
      links: g.links,
      lookingToMeet: g.lookingToMeet ?? null,
      creatorNote: g.creatorNote ?? null,
    })
    .returning();
  return row;
}

export async function listGuests(db: Db, creatorId: string, episodeId: string): Promise<Guest[]> {
  const rows = await db
    .select({ guest: guests })
    .from(guests)
    .innerJoin(episodes, eq(guests.episodeId, episodes.id))
    .where(and(eq(guests.episodeId, episodeId), eq(episodes.creatorId, creatorId)))
    .orderBy(desc(guests.createdAt));
  return rows.map((r) => r.guest);
}

/** Every guest across the creator's episodes, newest first, for the pipeline board. */
export async function listAllGuests(db: Db, creatorId: string): Promise<GuestWithEpisode[]> {
  const rows = await db
    .select({ guest: guests, episodeTopic: episodes.topic })
    .from(guests)
    .innerJoin(episodes, eq(guests.episodeId, episodes.id))
    .where(eq(episodes.creatorId, creatorId))
    .orderBy(desc(guests.updatedAt));
  return rows.map((r) => ({ ...r.guest, episodeTopic: r.episodeTopic }));
}

export async function getGuest(db: Db, creatorId: string, guestId: string): Promise<GuestWithEpisode | null> {
  const [row] = await db
    .select({ guest: guests, episodeTopic: episodes.topic })
    .from(guests)
    .innerJoin(episodes, eq(guests.episodeId, episodes.id))
    .where(and(eq(guests.id, guestId), eq(episodes.creatorId, creatorId)))
    .limit(1);
  return row ? { ...row.guest, episodeTopic: row.episodeTopic } : null;
}

export async function setGuestStatus(db: Db, creatorId: string, guestId: string, e: PipelineEvent): Promise<Guest> {
  const guest = await getGuest(db, creatorId, guestId);
  if (!guest) throw new NotFoundError("Guest");
  const status = applyEvent(guest.status, e);
  if (status === guest.status) return guest;
  const [row] = await db
    .update(guests)
    .set({ status, updatedAt: new Date() })
    .where(eq(guests.id, guestId))
    .returning();
  return row;
}
