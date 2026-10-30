"use client";

import { useActionState } from "react";
import { createEpisodeAction, type FormState, updateSettingsAction } from "@/app/actions";
import { Button, inputClass } from "@/components/ui";

export function NewEpisodeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createEpisodeAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input
        name="topic"
        required
        minLength={3}
        maxLength={200}
        placeholder="Episode topic, e.g. people who quit a safe path to build something"
        className={inputClass}
      />
      <Button disabled={pending} className="shrink-0">
        {pending ? "Creating…" : "New episode"}
      </Button>
      {state.error ? <p className="text-sm text-bad">{state.error}</p> : null}
    </form>
  );
}

export function SettingsForm({
  showName,
  showPitch,
  agentUsername,
  schedulingUrl,
}: {
  showName: string;
  showPitch: string;
  agentUsername: string;
  schedulingUrl: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateSettingsAction, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Show name</span>
        <input name="showName" defaultValue={showName} maxLength={120} placeholder="In Between" className={inputClass} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">One-line pitch</span>
        <textarea
          name="showPitch"
          defaultValue={showPitch}
          maxLength={300}
          rows={2}
          placeholder="Conversations about people's journeys, not their milestones."
          className={inputClass}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Booking link (optional)</span>
        <input
          name="schedulingUrl"
          type="url"
          defaultValue={schedulingUrl}
          maxLength={300}
          placeholder="https://calendly.com/you/30min"
          className={inputClass}
        />
        <span className="text-xs text-muted">
          Calendly, Cal.com or any booking page. Guests who say yes to an invite without fixed times book a slot here.
        </span>
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Your Agent Village agent&apos;s Telegram username</span>
        <input name="agentUsername" defaultValue={agentUsername} className={inputClass} />
        <span className="text-xs text-muted">The bot you chat with in Agent Village. Used by the “Open my agent” button.</span>
      </label>
      <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      {state.error ? <p className="text-sm text-bad">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-good">Saved.</p> : null}
    </form>
  );
}
