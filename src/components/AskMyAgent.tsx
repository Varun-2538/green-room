"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function AskMyAgent({ prompt, deepLink, agentUsername }: { prompt: string; deepLink: string; agentUsername: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Your agent (@{agentUsername}) reads your Mosaic circle and replies with guests, each with an{" "}
        <strong>Add to desk</strong> link. Only public info travels in that link.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={deepLink} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand/90">
          Open my agent in Telegram
        </a>
        <Button variant="secondary" type="button" onClick={copy}>
          {copied ? "Copied" : "Copy prompt"}
        </Button>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">See the prompt</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-background p-3 font-mono text-xs">{prompt}</pre>
      </details>
      <p className="text-xs text-muted">
        Tip: Mosaic can only search pair pages that exist. If your agent says few are written, open the links it gives
        you, then ask again.
      </p>
    </div>
  );
}
