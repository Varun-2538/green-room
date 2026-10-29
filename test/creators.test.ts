import { describe, expect, it } from "vitest";
import { getCreator, updateSettings, upsertCreatorFromTelegram } from "@/lib/creators";
import { makeTestDb } from "./helpers/db";

const user = { id: 42, first_name: "Varun", auth_date: 1 };

describe("creators", () => {
  it("keeps one row per Telegram id and refreshes the name", async () => {
    const db = await makeTestDb();
    const first = await upsertCreatorFromTelegram(db, user);
    const second = await upsertCreatorFromTelegram(db, { ...user, first_name: "Varun", last_name: "K" });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Varun K");
    expect((await getCreator(db, first.id))?.name).toBe("Varun K");
  });

  it("strips a leading @ from the agent username", async () => {
    const db = await makeTestDb();
    const c = await upsertCreatorFromTelegram(db, user);
    const updated = await updateSettings(db, c.id, { agentUsername: "@my_agent_bot" });
    expect(updated.agentUsername).toBe("my_agent_bot");
  });

  it("rejects an agent username that is not a Telegram username", async () => {
    const db = await makeTestDb();
    const c = await upsertCreatorFromTelegram(db, user);
    await expect(updateSettings(db, c.id, { agentUsername: "bad name!" })).rejects.toThrow(/agent username/i);
    await expect(updateSettings(db, c.id, { agentUsername: "abc" })).rejects.toThrow(/agent username/i);
  });

  it("saves show name and pitch", async () => {
    const db = await makeTestDb();
    const c = await upsertCreatorFromTelegram(db, user);
    const updated = await updateSettings(db, c.id, { showName: "In Between", showPitch: "Journeys, not milestones." });
    expect(updated.showName).toBe("In Between");
    expect(updated.showPitch).toBe("Journeys, not milestones.");
  });
});
