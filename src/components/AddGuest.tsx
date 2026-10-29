"use client";

import { useActionState, useState } from "react";
import { addGuestAction, type FormState } from "@/app/actions";
import { Button, inputClass } from "@/components/ui";

type EpisodeOption = { id: string; topic: string };

/** Confirm card for a guest arriving from the agent's "Add to desk" link. Nothing is saved until "Add to desk". */
export function ConfirmHandoff({
  params,
  episodes,
  defaultEpisodeId,
}: {
  params: Record<string, string>;
  episodes: EpisodeOption[];
  defaultEpisodeId?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addGuestAction, {});
  return (
    <form action={action} className="space-y-4">
      {Object.entries(params).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <EpisodePicker episodes={episodes} defaultEpisodeId={defaultEpisodeId} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">Your note (optional, only you see it)</span>
        <textarea name="creatorNote" rows={2} maxLength={500} className={inputClass} placeholder="Why I want them on the show" />
      </label>
      <Button disabled={pending || episodes.length === 0}>{pending ? "Adding…" : "Add to desk"}</Button>
      {state.error ? <p className="text-sm text-bad">{state.error}</p> : null}
    </form>
  );
}

export function AddGuestForm({ episodeId }: { episodeId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addGuestAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="episodeId" value={episodeId} />
      <input name="n" required maxLength={120} placeholder="Guest name" className={inputClass} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="x" type="url" placeholder="X / Twitter link" className={inputClass} />
        <input name="gh" type="url" placeholder="GitHub link" className={inputClass} />
        <input name="li" type="url" placeholder="LinkedIn link" className={inputClass} />
        <input name="yt" type="url" placeholder="YouTube link" className={inputClass} />
        <input name="web" type="url" placeholder="Website or other link" className={inputClass} />
        <input name="lm" maxLength={300} placeholder="Who they want to meet (from Rolodex)" className={inputClass} />
      </div>
      <Button variant="secondary" disabled={pending}>{pending ? "Adding…" : "Add guest"}</Button>
      {state.error ? <p className="text-sm text-bad">{state.error}</p> : null}
    </form>
  );
}

function EpisodePicker({ episodes, defaultEpisodeId }: { episodes: EpisodeOption[]; defaultEpisodeId?: string }) {
  const [value, setValue] = useState(defaultEpisodeId ?? episodes[0]?.id ?? "");
  if (episodes.length === 0) return <p className="text-sm text-bad">Create an episode on your desk first.</p>;
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">Episode</span>
      <select name="episodeId" value={value} onChange={(e) => setValue(e.target.value)} className={inputClass}>
        {episodes.map((e) => (
          <option key={e.id} value={e.id}>
            {e.topic}
          </option>
        ))}
      </select>
    </label>
  );
}
