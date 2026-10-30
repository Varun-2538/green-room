"use client";

import { useState } from "react";
import { CalendarButtons } from "@/components/CalendarButtons";
import { Button, inputClass } from "@/components/ui";
import { formatSlotIst } from "@/lib/calendar";
import type { TimeSlot } from "@/lib/db/schema";
import { readJsonResponse } from "@/lib/http";
import { inviteEvent } from "@/lib/invite-calendar";

type Answer = "accepted" | "time_suggested" | "declined";

const THANKS: Record<Answer, string> = {
  accepted: "You're in!",
  time_suggested: "Time suggestion sent.",
  declined: "Thanks for letting them know.",
};

/** anonymous: not logged in · creator: the sender · claimed: someone else already answered · guest: may answer */
export type ViewerState = "anonymous" | "creator" | "claimed" | "guest";

type Props = {
  viewerState: ViewerState;
  loginHref: string;
  code: string;
  appUrl: string;
  showName: string;
  creatorName: string;
  guestName: string;
  angle: string;
  timeOptions: TimeSlot[];
  initialAnswer?: Answer;
  initialSlot: number | null;
  /** The creator's booking page: offered after a yes when there are no fixed times. */
  schedulingUrl?: string;
};

export function AnswerButtons(props: Props) {
  const { code, creatorName, timeOptions } = props;
  const [answer, setAnswer] = useState<Answer | undefined>(props.initialAnswer);
  const [chosen, setChosen] = useState<number | null>(props.initialSlot);
  const [slot, setSlot] = useState<number | null>(props.initialSlot);
  const [editing, setEditing] = useState(!props.initialAnswer);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsSlot = timeOptions.length > 0;

  async function send(choice: Answer) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/i/${code}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answer: choice,
          note: note || undefined,
          ...(choice === "accepted" && slot !== null ? { slot } : {}),
        }),
      });
      const result = await readJsonResponse<{ chosenSlot: number | null }>(response);
      if (!result.ok) throw new Error(result.error);
      setAnswer(choice);
      setChosen(result.body.chosenSlot);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your answer.");
    } finally {
      setBusy(false);
    }
  }

  if (props.viewerState === "anonymous") {
    return (
      <div className="space-y-2 text-center">
        <a
          href={props.loginHref}
          className="inline-flex items-center gap-2 rounded-full bg-[#2AABEE] px-5 py-3 font-medium text-white hover:bg-[#229ED9]"
        >
          Log in with Telegram to answer
        </a>
        <p className="text-xs text-muted">
          So {creatorName} knows it&apos;s really you. Only your name and username are shared with them.
        </p>
      </div>
    );
  }

  if (props.viewerState === "creator") {
    return (
      <p className="rounded-xl bg-background p-3 text-center text-sm text-muted">
        This is your invite, as your guest will see it. Send them the link; their answer appears on your desk.
      </p>
    );
  }

  if (props.viewerState === "claimed") {
    return <p className="rounded-xl bg-background p-3 text-center text-sm text-muted">This invite has already been answered.</p>;
  }

  if (answer && !editing) {
    const event = inviteEvent({ ...props, answer, chosenSlot: chosen }, props.appUrl);
    return (
      <div className="space-y-3 text-center">
        <p className="font-display text-2xl text-brand">{THANKS[answer]}</p>
        {event ? <p className="font-medium">{formatSlotIst(event.start)}{event.location ? ` · ${event.location}` : ""}</p> : null}
        {answer === "accepted" && !event && props.schedulingUrl ? (
          <>
            <p className="text-muted">One last step: pick a slot on {creatorName}&apos;s calendar.</p>
            <a
              href={props.schedulingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-medium text-white hover:bg-accent/90"
            >
              Pick a time on {creatorName}&apos;s calendar →
            </a>
          </>
        ) : (
          <p className="text-muted">{creatorName} will see your answer.</p>
        )}
        {event ? <CalendarButtons event={{ ...event, start: event.start.toISOString() }} icsHref={`/api/i/${code}/calendar`} /> : null}
        <button onClick={() => setEditing(true)} className="text-sm text-muted underline">Change my answer</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {needsSlot ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Pick a time that works</legend>
          {timeOptions.map((t, i) => (
            <label
              key={t.start}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${slot === i ? "border-brand bg-brand/5" : "border-line"}`}
            >
              <input type="radio" name="slot" checked={slot === i} onChange={() => setSlot(i)} />
              <span>
                {formatSlotIst(new Date(t.start))}
                {t.place ? <span className="text-muted"> · {t.place}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={needsSlot ? "Add a note (optional), or suggest another time…" : "Add a note (optional): a time that works, a question…"}
        className={inputClass}
      />
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="accent" onClick={() => send("accepted")} disabled={busy || (needsSlot && slot === null)}>
          I&apos;m in
        </Button>
        <Button variant="secondary" onClick={() => send("time_suggested")} disabled={busy}>Suggest a time</Button>
        <Button variant="secondary" onClick={() => send("declined")} disabled={busy}>Not now</Button>
      </div>
      {needsSlot && slot === null ? <p className="text-center text-xs text-muted">Pick a time to say yes.</p> : null}
      {!needsSlot && props.schedulingUrl ? (
        <p className="text-center text-xs text-muted">Say yes and you&apos;ll pick a slot on {creatorName}&apos;s booking page.</p>
      ) : null}
      {error ? <p className="text-center text-sm text-bad">{error}</p> : null}
    </div>
  );
}
