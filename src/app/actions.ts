"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth/session";
import { updateSettings } from "@/lib/creators";
import { getDb } from "@/lib/db/client";
import { createEpisode } from "@/lib/episodes";
import { setGuestStatus } from "@/lib/guests";

export type FormState = { error?: string; ok?: boolean };

export async function createEpisodeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const db = getDb();
  const creator = await requireCreator(db);
  let episodeId: string;
  try {
    episodeId = (await createEpisode(db, creator.id, String(form.get("topic") ?? ""))).id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the episode." };
  }
  redirect(`/episode/${episodeId}`);
}

export async function updateSettingsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const db = getDb();
  const creator = await requireCreator(db);
  try {
    await updateSettings(db, creator.id, {
      showName: String(form.get("showName") ?? "") || undefined,
      showPitch: String(form.get("showPitch") ?? ""),
      agentUsername: String(form.get("agentUsername") ?? "") || undefined,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save settings." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markRecordedAction(form: FormData): Promise<void> {
  const db = getDb();
  const creator = await requireCreator(db);
  await setGuestStatus(db, creator.id, String(form.get("guestId")), "marked_recorded");
  revalidatePath("/desk");
}
