import { describe, expect, it } from "vitest";
import { applyEvent } from "@/lib/pipeline";

describe("applyEvent", () => {
  it.each([
    ["shortlisted", "brief_built", "brief_ready"],
    ["brief_ready", "invite_drafted", "drafted"],
    ["shortlisted", "invite_drafted", "drafted"],
    ["drafted", "invite_created", "invited"],
    ["invited", "invite_opened", "opened"],
    ["opened", "answered_accepted", "accepted"],
    ["invited", "answered_time", "time_suggested"],
    ["opened", "answered_declined", "declined"],
    ["accepted", "answered_declined", "declined"],
    ["declined", "answered_accepted", "accepted"],
    ["accepted", "marked_recorded", "recorded"],
  ] as const)("%s + %s → %s", (from, event, to) => {
    expect(applyEvent(from, event)).toBe(to);
  });

  it.each([
    ["accepted", "invite_opened", "accepted"],
    ["opened", "brief_built", "opened"],
    ["invited", "invite_drafted", "invited"],
    ["recorded", "answered_declined", "recorded"],
  ] as const)("never moves backwards: %s + %s stays %s", (from, event, to) => {
    expect(applyEvent(from, event)).toBe(to);
  });

  it.each([
    ["shortlisted", "answered_accepted"],
    ["drafted", "answered_declined"],
    ["opened", "marked_recorded"],
    ["time_suggested", "marked_recorded"],
  ] as const)("ignores %s + %s (event not valid yet)", (from, event) => {
    expect(applyEvent(from, event)).toBe(from);
  });
});
