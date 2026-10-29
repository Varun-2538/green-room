import { describe, expect, it } from "vitest";
import { draftInvite } from "@/lib/invite-draft";
import { mockJsonModel } from "./helpers/ai";

const input = {
  showName: "In Between",
  showPitch: "People's journeys, not their milestones.",
  creatorName: "Varun",
  guestName: "Arun",
  brief: {
    story: "Records 'What's your dream?' interviews.",
    recentWork: [],
    questions: [],
    facts: [{ text: "Hosts a street interview series on dreams", sourceUrl: "https://arun.example" }],
    limited: false,
    sources: ["https://arun.example"],
  },
  lookingToMeet: "storytellers",
  tone: "warm" as const,
  note: "mention his street interviews",
};

describe("draftInvite", () => {
  it("returns the model's message and angle", async () => {
    const ai = mockJsonModel({ message: "Hi Arun!", angle: "Dreams in transit" });
    expect(await draftInvite(input, { model: ai.model })).toEqual({ message: "Hi Arun!", angle: "Dreams in transit" });
  });

  it("trims the message to 1200 characters", async () => {
    const ai = mockJsonModel({ message: "a".repeat(2000), angle: "x" });
    expect((await draftInvite(input, { model: ai.model })).message).toHaveLength(1200);
  });

  it("grounds the draft in the brief facts and the creator's note", async () => {
    const ai = mockJsonModel({ message: "m", angle: "a" });
    await draftInvite(input, { model: ai.model });
    const prompt = ai.prompts()[0];
    expect(prompt).toContain("Hosts a street interview series on dreams");
    expect(prompt).toContain("mention his street interviews");
    expect(prompt).toContain("storytellers");
  });

  it("never mentions Mosaic to the model, so it can't leak into the invite", async () => {
    const ai = mockJsonModel({ message: "m", angle: "a" });
    await draftInvite(input, { model: ai.model });
    expect(ai.prompts()[0]).not.toMatch(/mosaic/i);
  });

  it("works without a brief", async () => {
    const ai = mockJsonModel({ message: "Hi", angle: "a" });
    expect((await draftInvite({ ...input, brief: null }, { model: ai.model })).message).toBe("Hi");
  });
});
