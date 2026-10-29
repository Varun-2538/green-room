import { eq } from "drizzle-orm";
import { z } from "zod";
import type { TelegramUser } from "@/lib/auth/telegram";
import type { Db } from "@/lib/db/client";
import { type Creator, creators } from "@/lib/db/schema";

export async function upsertCreatorFromTelegram(db: Db, u: TelegramUser): Promise<Creator> {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  const profile = { name, username: u.username ?? null, photoUrl: u.photo_url ?? null };
  const [row] = await db
    .insert(creators)
    .values({ telegramId: u.id, ...profile })
    .onConflictDoUpdate({ target: creators.telegramId, set: profile })
    .returning();
  return row;
}

export async function getCreator(db: Db, id: string): Promise<Creator | null> {
  const [row] = await db.select().from(creators).where(eq(creators.id, id)).limit(1);
  return row ?? null;
}

const settingsSchema = z.object({
  showName: z.string().trim().min(1).max(120).optional(),
  showPitch: z.string().trim().max(300).optional(),
  agentUsername: z
    .string()
    .trim()
    .transform((s) => s.replace(/^@/, ""))
    .pipe(z.string().regex(/^[A-Za-z0-9_]{5,32}$/, "Agent username must be a Telegram username (5–32 letters, digits or _)"))
    .optional(),
});

export type SettingsInput = z.input<typeof settingsSchema>;

export async function updateSettings(db: Db, id: string, s: SettingsInput): Promise<Creator> {
  const parsed = settingsSchema.safeParse(s);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  const [row] = await db.update(creators).set(parsed.data).where(eq(creators.id, id)).returning();
  if (!row) throw new Error("Creator not found");
  return row;
}
