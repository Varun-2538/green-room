"use client";

import { googleCalendarUrl } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/calendar";

/** "Add to Google Calendar" plus an .ics download for every other calendar app. */
export function CalendarButtons({ event, icsHref }: { event: Omit<CalendarEvent, "start"> & { start: string }; icsHref: string }) {
  const google = googleCalendarUrl({ ...event, start: new Date(event.start) });
  const link =
    "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-background";
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <a href={google} target="_blank" rel="noreferrer" className={link}>
        Add to Google Calendar
      </a>
      <a href={icsHref} className={link}>
        Download .ics (Apple, Outlook)
      </a>
    </div>
  );
}
