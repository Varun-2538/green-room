import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { type Episode, episodes, guests } from "@/lib/db/schema";

const topicSchema = z.string().trim().min(3, "Topic must be at least 3 characters").max(200, "Topic is too long");

export async function createEpisode(db: Db, creatorId: string, topic: string): Promise<Episode> {
  const parsed = topicSchema.safeParse(topic);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const [row] = await db.insert(episodes).values({ creatorId, topic: parsed.data }).returning();
  return row;
}

export async function listEpisodes(db: Db, creatorId: string): Promise<(Episode & { guestCount: number })[]> {
  return db
    .select({
      id: episodes.id,
      creatorId: episodes.creatorId,
      topic: episodes.topic,
      createdAt: episodes.createdAt,
      guestCount: count(guests.id),
    })
    .from(episodes)
    .leftJoin(guests, eq(guests.episodeId, episodes.id))
    .where(eq(episodes.creatorId, creatorId))
    .groupBy(episodes.id)
    .orderBy(desc(episodes.createdAt));
}

export async function getEpisode(db: Db, creatorId: string, episodeId: string): Promise<Episode | null> {
  const [row] = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.id, episodeId), eq(episodes.creatorId, creatorId)))
    .limit(1);
  return row ?? null;
}
