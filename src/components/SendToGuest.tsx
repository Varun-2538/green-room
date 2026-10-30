"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setGuestTelegramAction } from "@/app/actions";
import { Button, inputClass } from "@/components/ui";
import { inviteText, type SendChannel, sendChannels } from "@/lib/send-channels";

/**
 * One click to send an invite: opens the guest's Telegram chat with the message typed in, or, without Telegram,
 * their profile on another platform. The message is always copied too, in case the app doesn't pre-fill it.
 */
export function SendToGuest({ guestId, guestName, links, message, url }: { guestId: string; guestName: string; links: string[]; message: string; url: string }) {
  const router = useRouter();
  const text = inviteText(message, url);
  const channels = sendChannels(links, text);
  const [primary, ...others] = channels;
  const [copied, setCopied] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  async function send(channel: SendChannel) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(channel.platform);
    } catch {
      setCopied(null);
    }
    window.open(channel.href, "_blank", "noopener,noreferrer");
  }

  function saveTelegram() {
    setError(null);
    startSaving(async () => {
      const result = await setGuestTelegramAction(guestId, username);
      if (result.error) setError(result.error);
      else {
        setUsername("");
        router.refresh();
      }
    });
  }

  const hasTelegram = primary?.platform === "telegram";

  return (
    <div className="space-y-2">
      {primary ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => send(primary)}
            className={hasTelegram ? "bg-[#2AABEE] text-white hover:bg-[#229ED9]" : ""}
          >
            {hasTelegram ? `Send to ${guestName} on Telegram` : `Copy message & open ${primary.label}`}
          </Button>
          {others.map((c) => (
            <button key={c.platform} type="button" onClick={() => send(c)} className="text-sm text-brand underline-offset-2 hover:underline">
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
      {copied ? (
        <p className="text-xs text-muted">
          Message copied.{" "}
          {copied === "telegram" ? "It's typed into the chat; if not, paste it." : "Paste it into a DM once their profile opens."}
        </p>
      ) : null}
      {!hasTelegram ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{primary ? "Know their Telegram?" : `Add ${guestName}'s Telegram to send in one click:`}</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            maxLength={40}
            className={`${inputClass} w-40`}
            aria-label={`${guestName}'s Telegram username`}
          />
          <Button type="button" variant="secondary" onClick={saveTelegram} disabled={saving || !username.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-bad">{error}</p> : null}
    </div>
  );
}
