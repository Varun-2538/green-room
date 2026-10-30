/** Where a creator can send an invite with one click: the guest's Telegram first, then their other public profiles. */

export type SendChannel = {
  platform: "telegram" | "x" | "linkedin" | "instagram" | "web" | "github" | "youtube";
  label: string;
  href: string;
  /** True when the link opens a chat with the message already typed; otherwise the creator pastes it. */
  prefilled: boolean;
};

const TELEGRAM_USERNAME = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

/** A Telegram username from a t.me link, an @handle or a bare handle; null for anything else (e.g. group invite links). */
export function telegramLink(value: string): string | null {
  const v = value.trim();
  const fromUrl = /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/([^/?#]+)\/?$/i.exec(v);
  const candidate = fromUrl ? fromUrl[1] : /^[a-z]+:\/\//i.test(v) ? "" : v.replace(/^@/, "");
  return TELEGRAM_USERNAME.test(candidate) ? candidate : null;
}

const PLATFORMS: { platform: Exclude<SendChannel["platform"], "telegram">; label: string; hosts: RegExp }[] = [
  { platform: "x", label: "X", hosts: /^(?:www\.)?(?:x|twitter)\.com$/i },
  { platform: "linkedin", label: "LinkedIn", hosts: /(?:^|\.)linkedin\.com$/i },
  { platform: "instagram", label: "Instagram", hosts: /^(?:www\.)?instagram\.com$/i },
  { platform: "youtube", label: "YouTube", hosts: /(?:^|\.)youtube\.com$|^youtu\.be$/i },
  { platform: "github", label: "GitHub", hosts: /^(?:www\.)?github\.com$/i },
];

/** Most direct first: Telegram (pre-typed), then platforms with DMs, then a website, then code profiles. */
const ORDER: SendChannel["platform"][] = ["telegram", "x", "linkedin", "instagram", "web", "youtube", "github"];

export function sendChannels(links: string[], text: string): SendChannel[] {
  const channels: SendChannel[] = [];
  for (const link of links) {
    const username = telegramLink(link);
    if (username) {
      channels.push({ platform: "telegram", label: "Telegram", href: `https://t.me/${username}?text=${encodeURIComponent(text)}`, prefilled: true });
      continue;
    }
    let host: string;
    try {
      host = new URL(link).hostname;
    } catch {
      continue;
    }
    const known = PLATFORMS.find((p) => p.hosts.test(host));
    channels.push(known ? { platform: known.platform, label: known.label, href: link, prefilled: false } : { platform: "web", label: host.replace(/^www\./, ""), href: link, prefilled: false });
  }
  const seen = new Set<string>();
  return channels
    .filter((c) => !seen.has(c.platform) && seen.add(c.platform))
    .sort((a, b) => ORDER.indexOf(a.platform) - ORDER.indexOf(b.platform));
}

/** What the guest receives: the creator's message, then the invite card link. */
export function inviteText(message: string, url: string): string {
  return `${message.trim()}\n\n${url}`;
}
