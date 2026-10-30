import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { safeNextPath } from "@/lib/auth/redirect";
import { currentCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

const steps = [
  ["Find", "Your Agent Village agent picks guests from your Mosaic circle, by episode topic."],
  ["Research", "Green Room reads their public work with TinyFish: their story, recent talks, questions to ask."],
  ["Invite", "AI drafts the invite (an open model on Groq). You send it as a verified human: World ID, 5 a day."],
  ["Book", "The guest opens a card and answers. Your desk tracks every booking."],
];

export default async function Landing(props: PageProps<"/">) {
  const search = await props.searchParams;
  const next = safeNextPath(typeof search.next === "string" ? search.next : null, "/desk");
  if (await currentCreator(getDb())) redirect(next);

  const loginHref = `/api/auth/telegram/start?next=${encodeURIComponent(next)}`;

  return (
    <div className="grid gap-10 py-6 md:grid-cols-[1.2fr_1fr] md:items-center">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">For creators at Edge City</p>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-tight text-brand">
          Mosaic tells you who.
          <br />
          Green Room gets them on your show.
        </h1>
        <p className="mt-4 max-w-prose text-lg text-muted">
          A booking desk for podcasters, YouTubers and writers. Find the right guest in the village, know their story,
          and invite them like a real person, not a bot.
        </p>
        <div className="mt-8">
          <a
            href={loginHref}
            className="inline-flex items-center gap-2 rounded-full bg-[#2AABEE] px-5 py-3 font-medium text-white shadow-sm hover:bg-[#229ED9]"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
              <path d="M9.04 15.47 8.9 19.5c.4 0 .58-.17.79-.38l1.9-1.82 3.94 2.88c.72.4 1.24.19 1.43-.67l2.59-12.13c.26-1.07-.4-1.49-1.1-1.23L3.24 9.94c-1.04.4-1.03.98-.18 1.24l3.9 1.22 9.06-5.71c.43-.26.82-.12.5.17" />
            </svg>
            Log in with Telegram
          </a>
          {search.error === "login" ? (
            <p className="mt-2 text-sm text-bad">That Telegram login could not be checked. Please try again.</p>
          ) : null}
        </div>
      </div>
      <Card>
        <ol className="space-y-4">
          {steps.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm text-brand-ink">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
