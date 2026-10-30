import { describe, expect, it } from "vitest";
import { buildIcs, formatSlotIst, googleCalendarUrl, parseIstLocal } from "@/lib/calendar";

const event = {
  uid: "abc123def456@green-room",
  title: "In Between — recording with Arun",
  description: "Episode idea: dreams, detours; and the road back\nCard: https://green-room.test/i/abc123def456",
  start: new Date("2026-10-31T05:30:00Z"), // 11:00 IST
  durationMinutes: 60,
  location: "Terrace, Circle CoWork",
  url: "https://green-room.test/i/abc123def456",
};

describe("parseIstLocal", () => {
  it("reads a datetime-local value as India time", () => {
    expect(parseIstLocal("2026-10-31T11:00")?.toISOString()).toBe("2026-10-31T05:30:00.000Z");
  });

  it("handles a time just after midnight IST (previous day in UTC)", () => {
    expect(parseIstLocal("2026-11-01T00:15")?.toISOString()).toBe("2026-10-31T18:45:00.000Z");
  });

  it.each([["2026-10-31"], ["31/10/2026 11:00"], ["2026-13-01T11:00"], [""]])("rejects %s", (value) => {
    expect(parseIstLocal(value)).toBeNull();
  });
});

describe("formatSlotIst", () => {
  it("shows the day, date and time in India time", () => {
    expect(formatSlotIst(new Date("2026-10-31T05:30:00Z"))).toBe("Sat 31 Oct, 11:00 IST");
  });
});

describe("googleCalendarUrl", () => {
  it("prefills a Google Calendar event in UTC", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("In Between — recording with Arun");
    expect(url.searchParams.get("dates")).toBe("20261031T053000Z/20261031T063000Z");
    expect(url.searchParams.get("location")).toBe("Terrace, Circle CoWork");
    expect(url.searchParams.get("details")).toContain("https://green-room.test/i/abc123def456");
  });

  it("leaves location out when there is none", () => {
    expect(new URL(googleCalendarUrl({ ...event, location: undefined })).searchParams.has("location")).toBe(false);
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(event, new Date("2026-10-30T09:00:00Z"));
  const lines = ics.split("\r\n");

  it("is a VCALENDAR with one VEVENT, CRLF line endings and a trailing CRLF", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("has the required fields in UTC", () => {
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("METHOD:PUBLISH");
    expect(lines).toContain("UID:abc123def456@green-room");
    expect(lines).toContain("DTSTAMP:20261030T090000Z");
    expect(lines).toContain("DTSTART:20261031T053000Z");
    expect(lines).toContain("DTEND:20261031T063000Z");
  });

  it("escapes commas, semicolons and newlines in text", () => {
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("LOCATION:Terrace\\, Circle CoWork");
    expect(unfolded).toContain("DESCRIPTION:Episode idea: dreams\\, detours\\; and the road back\\nCard: https://green-room.test/i/abc123def456");
  });

  it("folds lines longer than 75 octets", () => {
    const long = buildIcs({ ...event, description: "x".repeat(300) }, new Date("2026-10-30T09:00:00Z"));
    for (const line of long.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    expect(long.replace(/\r\n /g, "")).toContain("DESCRIPTION:" + "x".repeat(300));
  });

  it("never splits a multi-byte character when folding", () => {
    const long = buildIcs({ ...event, title: "— ".repeat(60) }, new Date("2026-10-30T09:00:00Z"));
    expect(long.replace(/\r\n /g, "")).toContain("SUMMARY:" + "— ".repeat(60).trimEnd());
  });
});
