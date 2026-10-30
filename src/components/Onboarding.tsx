"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { completeOnboardingAction } from "@/app/actions";
import { Button } from "@/components/ui";
import { VerifyWithWorld } from "@/components/VerifyWithWorld";
import { type OnboardingStepId, onboardingSteps } from "@/lib/onboarding";

type Answers = { showName: string; showPitch: string; schedulingUrl: string; topic: string };
type TextField = keyof Answers;

const TEXT_STEPS: Record<Exclude<OnboardingStepId, "verify">, { field: TextField; question: string; hint: string; placeholder: string; max: number }> = {
  show: {
    field: "showName",
    question: "First, what's your show called?",
    hint: "Guests see it at the top of every invite.",
    placeholder: "In Between",
    max: 120,
  },
  pitch: {
    field: "showPitch",
    question: "Describe it in one line.",
    hint: "It sits under your show name on the invite card.",
    placeholder: "Conversations about people's journeys, not their milestones.",
    max: 300,
  },
  booking: {
    field: "schedulingUrl",
    question: "Do you use Calendly or another booking page?",
    hint: "Paste your link and guests who say yes can book a slot on it. Skip it and you'll offer times with each invite instead.",
    placeholder: "https://calendly.com/you/30min",
    max: 300,
  },
  episode: {
    field: "topic",
    question: "What's your next episode about?",
    hint: "Your Agent Village agent uses it to find guests in your Mosaic circle.",
    placeholder: "People who quit a safe path to build something",
    max: 200,
  },
};

const underlineInput =
  "w-full border-0 border-b-2 border-line bg-transparent px-0 py-3 font-display text-2xl text-foreground outline-none placeholder:text-muted/50 focus:border-brand sm:text-3xl";

/** First-run setup: one question per screen, optional ones skippable, then the desk takes over. */
export function Onboarding(props: {
  firstName: string;
  verified: boolean;
  episodeCount: number;
  world: { appId: `app_${string}`; rpId: string; action: string };
}) {
  const router = useRouter();
  const [steps] = useState(() => onboardingSteps({ verified: props.verified }));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ showName: "", showPitch: "", schedulingUrl: "", topic: "" });
  const [verified, setVerified] = useState(props.verified);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [saving, startSaving] = useTransition();

  const step = steps[index];
  const isLast = index === steps.length - 1;

  function finish(final: Answers) {
    setError(null);
    startSaving(async () => {
      const result = await completeOnboardingAction(final);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFinishing(true);
      // Let "Your desk is ready" land, then the server renders the dashboard in place of setup.
      setTimeout(() => router.refresh(), 900);
    });
  }

  function next(final: Answers = answers) {
    setError(null);
    if (isLast) finish(final);
    else setIndex(index + 1);
  }

  function skip() {
    if (step.id === "verify") return next();
    const field = TEXT_STEPS[step.id].field;
    const cleared = { ...answers, [field]: "" };
    setAnswers(cleared);
    next(cleared);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (step.id === "verify") return next();
    const value = answers[TEXT_STEPS[step.id].field].trim();
    if (!step.optional && !value) return setError("This one's needed: guests see it on every invite.");
    if (step.id === "episode" && value && value.length < 3) return setError("Give the topic at least 3 characters.");
    if (step.id === "booking" && value && !/^https:\/\/\S+\.\S+/i.test(value)) return setError("Paste the full link, starting with https://");
    next();
  }

  if (finishing) {
    return (
      <div className="rise-in flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="font-display text-4xl font-semibold text-brand">Your desk is ready.</p>
        <p className="mt-2 text-muted">{answers.showName.trim()} is open for guests.</p>
      </div>
    );
  }

  const text = step.id === "verify" ? null : TEXT_STEPS[step.id];

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-2xl flex-col justify-center">
      <div className="mb-10 flex items-center gap-3" aria-label={`Step ${index + 1} of ${steps.length}`}>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted">
          {index + 1} / {steps.length}
        </span>
      </div>

      <form key={step.id} onSubmit={submit} className="rise-in space-y-6">
        {index === 0 ? <p className="text-sm font-medium uppercase tracking-widest text-accent">Welcome to Green Room, {props.firstName}</p> : null}

        {text ? (
          <>
            <label htmlFor={`setup-${step.id}`} className="block font-display text-3xl font-semibold leading-tight text-brand sm:text-4xl">
              {text.question}
              {step.optional ? <span className="ml-2 align-middle text-sm font-normal text-muted">optional</span> : null}
            </label>
            <p className="-mt-3 text-muted">
              {text.hint}
              {step.id === "episode" && props.episodeCount > 0
                ? ` You already have ${props.episodeCount} episode${props.episodeCount === 1 ? "" : "s"}, so skip this if you don't need a new one.`
                : ""}
            </p>
            <input
              id={`setup-${step.id}`}
              autoFocus
              autoComplete="off"
              type={step.id === "booking" ? "url" : "text"}
              value={answers[text.field]}
              onChange={(e) => setAnswers({ ...answers, [text.field]: e.target.value })}
              maxLength={text.max}
              placeholder={text.placeholder}
              className={underlineInput}
            />
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold leading-tight text-brand sm:text-4xl">
              Prove you&apos;re a real person.
              <span className="ml-2 align-middle text-sm font-normal text-muted">optional</span>
            </h1>
            <p className="-mt-3 text-muted">
              World ID puts a verified badge on your invites, so guests know a real person is asking. You can send invites without it. We never see your name or face.
            </p>
            {verified ? (
              <p className="font-medium text-good">✓ Verified. Guests will see the badge.</p>
            ) : (
              <VerifyWithWorld
                appId={props.world.appId}
                rpId={props.world.rpId}
                action={props.world.action}
                next="/desk"
                onVerified={() => {
                  setVerified(true);
                  next();
                }}
              />
            )}
          </>
        )}

        {error ? <p className="text-sm text-bad">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {step.id !== "verify" || verified ? (
            <Button type="submit" disabled={saving} className="px-6 py-2.5 text-base">
              {saving ? "Setting up…" : isLast ? "Open my desk" : "OK"}
            </Button>
          ) : null}
          {step.optional && !(step.id === "verify" && verified) ? (
            <Button type="button" variant="secondary" onClick={skip} disabled={saving}>
              {step.id === "verify" ? "Later" : "Skip"}
            </Button>
          ) : null}
          {step.id !== "verify" ? <span className="hidden text-xs text-muted sm:inline">or press Enter ↵</span> : null}
          {index > 0 ? (
            <button type="button" onClick={() => setIndex(index - 1)} className="ml-auto text-sm text-muted underline-offset-2 hover:underline" disabled={saving}>
              ← Back
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
