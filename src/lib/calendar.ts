// Calendar invites without email: a Google Calendar link and an .ics file (RFC 5545).
// Pure functions only, so the invite card can use them in the browser too.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type CalendarEvent = {
  uid: string;
  title: string;
  description: string;
  start: Date;
  durationMinutes: number;
  location?: string;
  url: string;
};

/** Reads an `<input type="datetime-local">` value ("2026-10-31T11:00") as India time (UTC+5:30, no DST). */
export function parseIstLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const utc = Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MS;
  const check = new Date(utc + IST_OFFSET_MS);
  return check.getUTCDate() === d ? new Date(utc) : null;
}

/** "Sat 31 Oct, 11:00 IST" */
export function formatSlotIst(start: Date): string {
  const ist = new Date(start.getTime() + IST_OFFSET_MS);
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${DAYS[ist.getUTCDay()]} ${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}, ${hh}:${mm} IST`;
}

/** 20261031T053000Z */
function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const endOf = (e: CalendarEvent) => new Date(e.start.getTime() + e.durationMinutes * 60_000);

export function googleCalendarUrl(e: Omit<CalendarEvent, "uid" | "url"> & { url?: string }): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${utcStamp(e.start)}/${utcStamp(endOf(e as CalendarEvent))}`,
    details: e.description,
  });
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** RFC 5545 TEXT escaping. */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets without splitting a UTF-8 character; continuation lines start with a space. */
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    if (bytes + size > limit) {
      out.push(current);
      current = " ";
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n");
}

export function buildIcs(e: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Green Room//Booking desk//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(e.start)}`,
    `DTEND:${utcStamp(endOf(e))}`,
    `SUMMARY:${escapeText(e.title)}`,
    `DESCRIPTION:${escapeText(e.description)}`,
    ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
