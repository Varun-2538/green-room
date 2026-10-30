import { describe, expect, it } from "vitest";
import { inviteEvent } from "@/lib/invite-calendar";

const card = {
  code: "abc123def456",
  showName: "In Between",
  creatorName: "Varun",
  guestName: "Arun",
  angle: "Dreams and the road to them",
  answer: "accepted" as const,
  timeOptions: [{ start: "2026-10-31T05:30:00.000Z", place: "Terrace, Circle CoWork" }, { start: "2026-11-01T10:30:00.000Z" }],
  chosenSlot: 0,
};

describe("inviteEvent", () => {
  it("builds the event for the slot the guest picked", () => {
    expect(inviteEvent(card, "https://green-room.test")).toEqual({
      uid: "abc123def456@green-room",
      title: "In Between: recording with Varun and Arun",
      description: "Episode idea: Dreams and the road to them\nInvite: https://green-room.test/i/abc123def456",
      start: new Date("2026-10-31T05:30:00.000Z"),
      durationMinutes: 60,
      location: "Terrace, Circle CoWork",
      url: "https://green-room.test/i/abc123def456",
    });
  });

  it("uses the second slot when that is the one picked, without a place", () => {
    const e = inviteEvent({ ...card, chosenSlot: 1 }, "https://green-room.test");
    expect(e?.start.toISOString()).toBe("2026-11-01T10:30:00.000Z");
    expect(e?.location).toBeUndefined();
  });

  it("has no event until the guest has said yes to a slot", () => {
    expect(inviteEvent({ ...card, chosenSlot: null }, "https://green-room.test")).toBeNull();
    expect(inviteEvent({ ...card, answer: "declined" }, "https://green-room.test")).toBeNull();
  });
});
