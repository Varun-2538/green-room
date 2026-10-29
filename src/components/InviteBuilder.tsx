"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, inputClass } from "@/components/ui";
import type { InviteTone } from "@/lib/invite-draft";

type Props = {
  guestId: string;
  guestName: string;
  verified: boolean;
  invitesLeft: number;
  dailyLimit: number;
  existingUrls: string[];
};

export function InviteBuilder({ guestId, guestName, verified, invitesLeft, dailyLimit, existingUrls }: Props) {
  const router = useRouter();
  const [tone, setTone] = useState<InviteTone>("warm");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [angle, setAngle] = useState("");
  const [times, setTimes] = useState(["", "", ""]);
  const [url, setUrl] = useState<string | null>(null);
  const [left, setLeft] = useState(invitesLeft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "create" | null>(null);
  const [copied, setCopied] = useState(false);

  async function post(payload: object) {
    const response = await fetch("/api/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guestId, ...payload }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
    return body;
  }

  async function draft() {
    setBusy("draft");
    setError(null);
    try {
      const d = (await post({ action: "draft", tone, note: note || undefined })) as { message: string; angle: string };
      setMessage(d.message);
      setAngle(d.angle);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drafting failed.");
    } finally {
      setBusy(null);
    }
  }

  async function create() {
    setBusy("create");
    setError(null);
    try {
      const r = (await post({ action: "create", message, angle, timeOptions: times.filter(Boolean) })) as { url: string };
      setUrl(r.url);
      setLeft((n) => Math.max(0, n - 1));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the invite.");
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">Tone</span>
          <select value={tone} onChange={(e) => setTone(e.target.value as InviteTone)} className={inputClass}>
            <option value="warm">Warm</option>
            <option value="brief">Brief</option>
            <option value="playful">Playful</option>
          </select>
        </label>
        <label className="min-w-48 flex-1 space-y-1">
          <span className="text-sm font-medium">Anything to mention?</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} placeholder="e.g. we met at the Frontier Intelligence talk" />
        </label>
        <Button variant="secondary" onClick={draft} disabled={busy !== null}>
          {busy === "draft" ? "Drafting…" : message ? "Redraft" : `Draft invite for ${guestName}`}
        </Button>
      </div>

      {message ? (
        <>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Invite message</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} maxLength={1200} className={inputClass} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Episode angle</span>
            <input value={angle} onChange={(e) => setAngle(e.target.value)} maxLength={200} className={inputClass} />
          </label>
          <div className="space-y-1">
            <span className="text-sm font-medium">Time options (up to 3)</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {times.map((t, i) => (
                <input
                  key={i}
                  value={t}
                  maxLength={80}
                  onChange={(e) => setTimes((all) => all.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder={["Sat 11:00 at the terrace", "Sun 16:00", "Any evening this week"][i]}
                  className={inputClass}
                />
              ))}
            </div>
          </div>
          {verified ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={create} disabled={busy !== null || left === 0 || !message.trim()}>
                {busy === "create" ? "Creating…" : "Create verified invite"}
              </Button>
              <span className="text-sm text-muted">{left} of {dailyLimit} invites left today</span>
            </div>
          ) : (
            <Link href={`/verify?next=/guest/${guestId}`} className="text-sm font-medium text-brand underline">
              Verify with World ID to create invites
            </Link>
          )}
        </>
      ) : null}

      {error ? <p className="text-sm text-bad">{error}</p> : null}

      {url ? (
        <div className="space-y-2 rounded-xl bg-good/10 p-3 text-sm">
          <p className="font-medium text-good">Invite ready. Send this link in your Telegram chat with {guestName}:</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-surface px-2 py-1">{url}</code>
            <Button variant="secondary" onClick={() => copy(url)}>{copied ? "Copied" : "Copy"}</Button>
          </div>
          <p className="text-xs text-muted">No chat yet? Ask your agent to introduce you through Agent Village first.</p>
        </div>
      ) : null}

      {existingUrls.length > 0 ? (
        <div className="text-xs text-muted">
          Earlier invites:{" "}
          {existingUrls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2 underline">{u.split("/").pop()}</a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
