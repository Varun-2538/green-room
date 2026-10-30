"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, inputClass } from "@/components/ui";
import { readJsonResponse } from "@/lib/http";
import type { InviteTone } from "@/lib/invite-draft";

type Props = {
  guestId: string;
  guestName: string;
  verified: boolean;
  invitesLeft: number;
  dailyLimit: number;
};

export function InviteBuilder({ guestId, guestName, verified, invitesLeft, dailyLimit }: Props) {
  const router = useRouter();
  const [tone, setTone] = useState<InviteTone>("warm");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [angle, setAngle] = useState("");
  const [times, setTimes] = useState([0, 1, 2].map(() => ({ start: "", place: "" })));
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
    const result = await readJsonResponse(response);
    if (!result.ok) throw new Error(result.error);
    return result.body;
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
      const timeOptions = times.filter((t) => t.start).map((t) => ({ start: t.start, ...(t.place.trim() ? { place: t.place.trim() } : {}) }));
      const r = (await post({ action: "create", message, angle, timeOptions })) as { url: string };
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
            <span className="text-sm font-medium">Times to offer (India time, up to 3)</span>
            <p className="text-xs text-muted">The guest picks one and can add it to their calendar.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {times.map((t, i) => (
                <div key={i} className="space-y-1">
                  <input
                    type="datetime-local"
                    value={t.start}
                    onChange={(e) => setTimes((all) => all.map((v, j) => (j === i ? { ...v, start: e.target.value } : v)))}
                    className={inputClass}
                    aria-label={`Time option ${i + 1}`}
                  />
                  <input
                    value={t.place}
                    maxLength={80}
                    onChange={(e) => setTimes((all) => all.map((v, j) => (j === i ? { ...v, place: e.target.value } : v)))}
                    placeholder={["Terrace, Circle CoWork", "Online", "Place (optional)"][i]}
                    className={inputClass}
                    aria-label={`Place for time option ${i + 1}`}
                  />
                </div>
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

    </div>
  );
}
