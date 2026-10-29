"use client";

import { useState } from "react";
import { Button, inputClass } from "@/components/ui";

type Answer = "accepted" | "time_suggested" | "declined";

const THANKS: Record<Answer, string> = {
  accepted: "You're in!",
  time_suggested: "Time suggestion sent.",
  declined: "Thanks for letting them know.",
};

export function AnswerButtons({
  code,
  creatorName,
  initialAnswer,
}: {
  code: string;
  creatorName: string;
  initialAnswer?: Answer;
}) {
  const [answer, setAnswer] = useState<Answer | undefined>(initialAnswer);
  const [editing, setEditing] = useState(!initialAnswer);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(choice: Answer) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/i/${code}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: choice, note: note || undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not send your answer.");
      setAnswer(choice);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your answer.");
    } finally {
      setBusy(false);
    }
  }

  if (answer && !editing) {
    return (
      <div className="space-y-2 text-center">
        <p className="font-display text-2xl text-brand">{THANKS[answer]}</p>
        <p className="text-muted">{creatorName} will see your answer.</p>
        <button onClick={() => setEditing(true)} className="text-sm text-muted underline">Change my answer</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Add a note (optional): a time that works, a question…"
        className={inputClass}
      />
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="accent" onClick={() => send("accepted")} disabled={busy}>I&apos;m in</Button>
        <Button variant="secondary" onClick={() => send("time_suggested")} disabled={busy}>Suggest a time</Button>
        <Button variant="secondary" onClick={() => send("declined")} disabled={busy}>Not now</Button>
      </div>
      {error ? <p className="text-center text-sm text-bad">{error}</p> : null}
    </div>
  );
}
