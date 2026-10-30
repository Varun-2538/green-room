import type { Db } from "@/lib/db/client";
import { updateSettings } from "@/lib/creators";
import { createEpisode } from "@/lib/episodes";

export type OnboardingStepId = "show" | "pitch" | "booking" | "verify" | "episode";
export type OnboardingStep = { id: OnboardingStepId; optional: boolean };

/** First-run setup, one question at a time. Only the show name is required: guests see it on every invite. */
export function onboardingSteps({ verified }: { verified: boolean }): OnboardingStep[] {
  return [
    { id: "show", optional: false },
    { id: "pitch", optional: true },
    { id: "booking", optional: true },
    ...(verified ? [] : [{ id: "verify", optional: true } as const]),
    { id: "episode", optional: true },
  ];
}

/** A creator sees setup instead of the dashboard until their show has a name. */
export function needsOnboarding(creator: { showName: string | null }): boolean {
  return !creator.showName;
}

export type OnboardingAnswers = { showName: string; showPitch: string; schedulingUrl: string; topic: string };

/** Saves the setup answers together: the show, and the first episode if one was given. */
export async function completeOnboarding(db: Db, creatorId: string, a: OnboardingAnswers): Promise<{ episodeId: string | null }> {
  const showName = a.showName.trim();
  if (!showName) throw new Error("Add a show name: guests see it on every invite.");
  const topic = a.topic.trim();
  return db.transaction(async (tx) => {
    await updateSettings(tx as unknown as Db, creatorId, { showName, showPitch: a.showPitch, schedulingUrl: a.schedulingUrl });
    const episode = topic ? await createEpisode(tx as unknown as Db, creatorId, topic) : null;
    return { episodeId: episode?.id ?? null };
  });
}

