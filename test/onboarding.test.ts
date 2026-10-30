import { describe, expect, it } from "vitest";
import { getCreator, upsertCreatorFromTelegram } from "@/lib/creators";
import { listEpisodes } from "@/lib/episodes";
import { completeOnboarding, needsOnboarding, onboardingSteps } from "@/lib/onboarding";
import { makeTestDb } from "./helpers/db";

describe("onboardingSteps", () => {
  it("asks one thing at a time, and only the show name is required", () => {
    const steps = onboardingSteps({ verified: false });
    expect(steps.map((s) => s.id)).toEqual(["show", "pitch", "booking", "verify", "episode"]);
    expect(steps.filter((s) => !s.optional).map((s) => s.id)).toEqual(["show"]);
  });

  it("leaves out World ID for someone already verified", () => {
    expect(onboardingSteps({ verified: true }).map((s) => s.id)).toEqual(["show", "pitch", "booking", "episode"]);
  });
});

describe("needsOnboarding", () => {
  it("is true until the creator has named their show", () => {
    expect(needsOnboarding({ showName: null })).toBe(true);
    expect(needsOnboarding({ showName: "In Between" })).toBe(false);
  });
});

describe("completeOnboarding", () => {
  const user = { id: 7, first_name: "Varun", auth_date: 1 };

  it("saves the show and creates the first episode", async () => {
    const db = await makeTestDb();
    const c = await upsertCreatorFromTelegram(db, user);
    const result = await completeOnboarding(db, c.id, { showName: "In Between", showPitch: "Journeys, not milestones.", schedulingUrl: "https://calendly.com/me/30min", topic: "People who quit a safe path" });
    const saved = await getCreator(db, c.id);
    expect(saved?.showName).toBe("In Between");
    expect(saved?.showPitch).toBe("Journeys, not milestones.");
    expect(saved?.schedulingUrl).toBe("https://calendly.com/me/30min");
    const episodes = await listEpisodes(db, c.id);
    expect(episodes.map((e) => e.topic)).toEqual(["People who quit a safe path"]);
    expect(result.episodeId).toBe(episodes[0].id);
  });

  it("skips the optional answers", async () => {
    const db = await makeTestDb();
    const c = await upsertCreatorFromTelegram(db, user);
    const result = await completeOnboarding(db, c.id, { showName: "In Between", showPitch: "", schedulingUrl: "", topic: "  " });
    expect(result.episodeId).toBeNull();
    expect(await listEpisodes(db, c.id)).toEqual([]);
    expect((await getCreator(db, c.id))?.showName).toBe("In Between");
  });

  it("needs a show name, and saves nothing without one", async () => {
    const db = await makeTestDb();
    const c = await upsertCreatorFromTelegram(db, user);
    await expect(completeOnboarding(db, c.id, { showName: " ", showPitch: "x", schedulingUrl: "", topic: "A real topic" })).rejects.toThrow(/show name/i);
    expect(await listEpisodes(db, c.id)).toEqual([]);
    expect((await getCreator(db, c.id))?.showPitch).toBeNull();
  });
});
