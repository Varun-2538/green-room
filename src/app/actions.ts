"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth/session";
import { updateSettings } from "@/lib/creators";
import { getDb } from "@/lib/db/client";
import { createEpisode } from "@/lib/episodes";
import { addGuest, NotFoundError, setGuestStatus, setGuestTelegram } from "@/lib/guests";
import { ALLOWED_PARAMS, parseHandoff } from "@/lib/handoff";
import { completeOnboarding, type OnboardingAnswers } from "@/lib/onboarding";

export type FormState = { error?: string; ok?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      schedulingUrl: String(form.get("schedulingUrl") ?? ""),
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

/** Adds a guest from an "Add to desk" link or the manual form; both go through the same validator. */
export async function addGuestAction(_prev: FormState, form: FormData): Promise<FormState> {
  const db = getDb();
  const creator = await requireCreator(db);
  const params = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const value = form.get(key);
    if (typeof value === "string" && value) params.set(key, value);
  }
  const parsed = parseHandoff(params);
  if (!parsed.ok) return { error: parsed.errors.join(" ") };

  const episodeId = String(form.get("episodeId") ?? "");
  if (!UUID.test(episodeId)) return { error: "Pick one of your episodes." };
  const note = String(form.get("creatorNote") ?? "").trim().slice(0, 500);
  let guestId: string;
  try {
    guestId = (await addGuest(db, creator.id, episodeId, { ...parsed.guest, ...(note ? { creatorNote: note } : {}) })).id;
  } catch (e) {
    if (e instanceof NotFoundError) return { error: "Pick one of your episodes." };
    throw e;
  }
  revalidatePath("/desk");
  redirect(`/guest/${guestId}`);
}

export async function completeOnboardingAction(answers: OnboardingAnswers): Promise<FormState> {
  const db = getDb();
  const creator = await requireCreator(db);
  try {
    await completeOnboarding(db, creator.id, {
      showName: String(answers.showName ?? ""),
      showPitch: String(answers.showPitch ?? ""),
      schedulingUrl: String(answers.schedulingUrl ?? ""),
      topic: String(answers.topic ?? ""),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save your setup." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Saves a guest's Telegram username so invites can be sent to them in one click. */
export async function setGuestTelegramAction(guestId: string, username: string): Promise<FormState> {
  const db = getDb();
  const creator = await requireCreator(db);
  if (!UUID.test(guestId)) return { error: "Guest not found." };
  try {
    await setGuestTelegram(db, creator.id, guestId, username);
  } catch (e) {
    if (e instanceof NotFoundError) return { error: "Guest not found." };
    return { error: e instanceof Error ? e.message : "Could not save their Telegram." };
  }
  revalidatePath(`/guest/${guestId}`);
  return { ok: true };
}
