/** A same-origin path to redirect to after login, or the fallback for anything that could leave the site. */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

const INVITE_PATH = /^\/i\/[A-Za-z0-9_-]{12}$/;

/**
 * Where to go after Telegram login: creators verify with World ID first; guests go straight back to their invite.
 * The desk needs no detour: its first-run setup includes World ID.
 */
export function postLoginDestination(next: string, verified: boolean): string {
  if (verified || next === "/desk" || INVITE_PATH.test(next)) return next;
  return `/verify?next=${encodeURIComponent(next)}`;
}
