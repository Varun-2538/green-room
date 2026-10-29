"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState } from "react";
import { Button, inputClass } from "@/components/ui";

const TOOL_LABEL: Record<string, string> = {
  "tool-list_pipeline": "Checked your pipeline",
  "tool-get_brief": "Read the guest brief",
  "tool-draft_invite": "Drafted an invite",
  "tool-set_status": "Updated the status",
  "tool-invites_left": "Checked today's invites",
};

type DraftOutput = { message?: string; angle?: string };

export function DeskChat({
  guestId,
  initialMessages,
  suggestions,
}: {
  guestId?: string;
  initialMessages: UIMessage[];
  suggestions: string[];
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat", body: { guestId: guestId ?? null } }),
  });
  const busy = status === "submitted" || status === "streaming";

  function send(text: string) {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[28rem] space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1 text-sm hover:bg-background">
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "ml-8 rounded-2xl bg-brand px-3 py-2 text-sm text-brand-ink" : "mr-8 space-y-2 text-sm"}>
            {m.parts.map((part, i) => {
              if (part.type === "text") return <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
              if (part.type.startsWith("tool-") && "state" in part) {
                const draft = part.type === "tool-draft_invite" && part.state === "output-available" ? (part.output as DraftOutput) : null;
                return (
                  <div key={i} className="rounded-xl border border-line bg-background px-3 py-2 text-xs text-muted">
                    {part.state === "output-available" ? `✓ ${TOOL_LABEL[part.type] ?? part.type}` : `${TOOL_LABEL[part.type] ?? "Working"}…`}
                    {draft?.message ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{draft.message}</p>
                    ) : null}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ))}
        {status === "submitted" ? <p className="text-sm text-muted">Thinking…</p> : null}
        {error ? <p className="text-sm text-bad">The assistant couldn&apos;t answer just now. Try again.</p> : null}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Green Room…" className={inputClass} />
        <Button disabled={busy || !input.trim()}>Send</Button>
      </form>
    </div>
  );
}
