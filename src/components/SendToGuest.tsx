"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setGuestTelegramAction } from "@/app/actions";
import { Button, inputClass } from "@/components/ui";
import { inviteText, type SendChannel, sendChannels } from "@/lib/send-channels";

/** How to fill in a missing Telegram: a username the agent found in the Rolodex, and a link to ask the agent. */
export type TelegramHelp = { suggested?: string; agentHref: string };

/**
 * One click to send an invite: opens the guest's Telegram chat with the message typed in, or, without Telegram,
 * their profile on another platform. The message is always copied too, in case the app doesn't pre-fill it.
 */
export function SendToGuest({
  guestName,
  links,
  message,
  url,
  telegram,
}: {
  guestId: string;
  guestName: string;
  links: string[];
  message: string;
  url: string;
  telegram: TelegramHelp;
}) {
  const text = inviteText(message, url);
  const channels = sendChannels(links, text);
  const [primary, ...others] = channels;
  const [copied, setCopied] = useState<string | null>(null);

  async function send(channel: SendChannel) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(channel.platform);
    } catch {
      setCopied(null);
    }
    window.open(channel.href, "_blank", "noopener,noreferrer");
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
        <p className="text-xs text-muted">
          {telegram.suggested ? (
            `Your agent found ${guestName}'s Telegram: save it under About to send there in one click.`
          ) : (
            <>
              No Telegram for {guestName} yet.{" "}
              <a href={telegram.agentHref} target="_blank" rel="noreferrer" className="text-brand underline">
                Get it from my agent (Rolodex)
              </a>
              , or add it under About.
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The guest's Telegram username: prefilled when the creator's agent looked it up in the Rolodex (its reply links back
 * here with ?tg=), empty otherwise, with a button to ask the agent.
 */
export function TelegramField({ guestId, guestName, lead, suggested, agentHref }: TelegramHelp & { guestId: string; guestName: string; lead: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(suggested ? `@${suggested}` : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await setGuestTelegramAction(guestId, username);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-1 text-sm">
      <p className="text-muted">{suggested ? `Your agent found ${guestName}'s Telegram in the Rolodex. Save it to send in one click:` : lead}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-48">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            maxLength={40}
            className={inputClass}
            aria-label={`${guestName}'s Telegram username`}
          />
        </div>
        <Button type="button" variant={suggested ? "primary" : "secondary"} onClick={save} disabled={saving || !username.trim()}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {!suggested ? (
          <a href={agentHref} target="_blank" rel="noreferrer" className="text-brand underline-offset-2 hover:underline">
            Get it from my agent (Rolodex)
          </a>
        ) : null}
      </div>
      {error ? <p className="text-xs text-bad">{error}</p> : null}
    </div>
  );
}
