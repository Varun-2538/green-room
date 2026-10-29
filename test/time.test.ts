import { describe, expect, it } from "vitest";
import { istDayStart, nextIstMidnight } from "@/lib/time";

describe("istDayStart", () => {
  it("is the previous 18:30 UTC just before IST midnight", () => {
    expect(istDayStart(new Date("2026-10-30T18:29:00Z")).toISOString()).toBe("2026-10-29T18:30:00.000Z");
  });

  it("rolls over at IST midnight (18:30 UTC)", () => {
    expect(istDayStart(new Date("2026-10-30T18:31:00Z")).toISOString()).toBe("2026-10-30T18:30:00.000Z");
  });

  it("handles a midday IST time", () => {
    expect(istDayStart(new Date("2026-10-30T06:00:00Z")).toISOString()).toBe("2026-10-29T18:30:00.000Z");
  });
});

describe("nextIstMidnight", () => {
  it("is 24 hours after the IST day start", () => {
    expect(nextIstMidnight(new Date("2026-10-30T06:00:00Z")).toISOString()).toBe("2026-10-30T18:30:00.000Z");
  });
});
