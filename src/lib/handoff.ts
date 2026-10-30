import type { GuestInput } from "@/lib/guests";
import { telegramLink } from "@/lib/send-channels";

/** The only query params the desk reads. Anything else (e.g. text from a Mosaic page) is never touched. */
export const ALLOWED_PARAMS = ["n", "tg", "x", "gh", "li", "yt", "web", "lm", "t", "ep"] as const;
const LINK_PARAMS = ["x", "gh", "li", "yt", "web"] as const;

const MAX_NAME = 120;
const MAX_LINK = 500;
const MAX_LOOKING_TO_MEET = 300;
const MAX_TOPIC = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HandoffResult =
  | { ok: true; guest: GuestInput; topic?: string; episodeId?: string; warnings: string[] }
  | { ok: false; errors: string[] };

function safeLink(value: string): string | null {
  if (value.length > MAX_LINK) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/** Reads an "Add to desk" link from the creator's agent. Nothing is stored here; the creator confirms first. */
export function parseHandoff(sp: URLSearchParams): HandoffResult {
  const name = (sp.get("n") ?? "").trim();
  if (!name) return { ok: false, errors: ["The link has no guest name."] };
  if (name.length > MAX_NAME) return { ok: false, errors: ["The guest name is too long."] };

  const warnings: string[] = [];
  const links: string[] = [];
  // Telegram comes first: it is how one-click send reaches the guest.
  const tg = (sp.get("tg") ?? "").trim();
  if (tg) {
    const username = telegramLink(tg);
    if (username) links.push(`https://t.me/${username}`);
    else warnings.push(`Skipped a Telegram username that isn't valid: ${tg.slice(0, 40)}`);
  }
  for (const param of LINK_PARAMS) {
    const raw = (sp.get(param) ?? "").trim();
    if (!raw) continue;
    const link = safeLink(raw);
    if (!link) warnings.push(`Skipped a link that isn't a safe https address: ${raw.slice(0, 60)}`);
    else if (!links.includes(link)) links.push(link);
  }

  const lookingToMeet = (sp.get("lm") ?? "").trim().slice(0, MAX_LOOKING_TO_MEET) || undefined;
  const topic = (sp.get("t") ?? "").trim().slice(0, MAX_TOPIC) || undefined;
  const ep = (sp.get("ep") ?? "").trim();

  return {
    ok: true,
    guest: { name, links, ...(lookingToMeet ? { lookingToMeet } : {}) },
    ...(topic ? { topic } : {}),
    ...(UUID.test(ep) ? { episodeId: ep } : {}),
    warnings,
  };
}

/** The message the creator sends their Agent Village agent to get guests back as "Add to desk" links. */
export function buildAgentPrompt(o: { showName: string; topic: string; appUrl: string; episodeId: string }): string {
  const link = `${o.appUrl}/add?n=<name>&tg=<telegram_username>&x=<x_url>&gh=<github_url>&web=<other_url>&lm=<looking_to_meet>&t=<topic>&ep=${o.episodeId}`;
  return [
    `Green Room: using my Mosaic pair pages and top matches, find 3 guests for my show "${o.showName}" on "${o.topic}".`,
    "For each person, look them up in the Rolodex and tell me why we fit (that part is for me only).",
    `Then give me an "Add to desk" link exactly like ${link}`,
    "For tg, use their Telegram username from their Rolodex profile: it's how I'll message them.",
    "URL-encode each value and leave out any part you don't have.",
    "Put only public Rolodex info in the link, never anything from our Mosaic page.",
    "If only a few of my pair pages are written, tell me which links to open so you can search more of my circle.",
  ].join("\n");
}

/** Asks the agent for a guest's Telegram from the Rolodex; its reply links back to the guest page with it filled in. */
export function telegramLookupPrompt(o: { guestName: string; appUrl: string; guestId: string }): string {
  return [
    `Green Room: look up ${o.guestName} in the Rolodex and find their Telegram username on their profile.`,
    `Reply with only this link, with the username filled in: ${o.appUrl}/guest/${o.guestId}?tg=<telegram_username>`,
    "If their profile has no Telegram, just say so.",
  ].join("\n");
}

/** Opens a Telegram DM with the creator's agent with `text` pre-typed. */
export function agentDeepLink(username: string, text: string): string {
  return `https://t.me/${username.replace(/^@/, "")}?text=${encodeURIComponent(text)}`;
}
