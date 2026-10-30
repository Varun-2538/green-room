"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import type { Brief } from "@/lib/brief";
import { readJsonResponse } from "@/lib/http";

export function BriefPanel({ guestId, initial }: { guestId: string; initial: Brief | null }) {
  const router = useRouter();
  const [brief, setBrief] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function build() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestId }),
      });
      const result = await readJsonResponse<Brief>(response);
      if (!result.ok) throw new Error(result.error);
      setBrief(result.body);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!brief) {
    return (
      <div className="space-y-3">
        <p className="text-muted">
          Green Room reads their public work with TinyFish (links, talks, posts) and writes their story and 8 questions.
          Every fact comes with its source.
        </p>
        <Button onClick={build} disabled={loading}>{loading ? "Researching… (about 20s)" : "Build guest brief"}</Button>
        {error ? <p className="text-sm text-bad">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="leading-relaxed">{brief.story}</p>
        {brief.limited ? <Badge tone="warn">Limited public info</Badge> : null}
      </div>

      {brief.facts.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Facts</h3>
          <ul className="space-y-1 text-sm">
            {brief.facts.map((f) => (
              <li key={f.text}>
                {f.text}{" "}
                <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
                  source
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {brief.recentWork.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Recent work</h3>
          <ul className="space-y-1 text-sm">
            {brief.recentWork.map((w) => (
              <li key={w.url}>
                <a href={w.url} target="_blank" rel="noreferrer" className="text-brand underline">{w.title}</a>
                {w.date ? <span className="text-muted"> · {w.date}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Questions to ask</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {brief.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </div>

      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Sources ({brief.sources.length})</summary>
        <ul className="mt-1 space-y-0.5">
          {brief.sources.map((s) => (
            <li key={s}><a href={s} target="_blank" rel="noreferrer" className="underline">{s}</a></li>
          ))}
        </ul>
      </details>

      <Button variant="secondary" onClick={build} disabled={loading}>{loading ? "Researching…" : "Rebuild brief"}</Button>
      {error ? <p className="text-sm text-bad">{error}</p> : null}
    </div>
  );
}
