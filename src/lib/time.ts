const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant the current calendar day began in India (Asia/Kolkata, UTC+5:30, no DST). */
export function istDayStart(now: Date): Date {
  const istMs = now.getTime() + IST_OFFSET_MS;
  return new Date(istMs - (istMs % DAY_MS) - IST_OFFSET_MS);
}

export function nextIstMidnight(now: Date): Date {
  return new Date(istDayStart(now).getTime() + DAY_MS);
}

export function formatIstTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}
