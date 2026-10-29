import { ConfirmHandoff } from "@/components/AddGuest";
import { Badge, Card, PageTitle } from "@/components/ui";
import { requireCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listEpisodes } from "@/lib/episodes";
import { ALLOWED_PARAMS, parseHandoff } from "@/lib/handoff";

export default async function AddPage(props: PageProps<"/add">) {
  const search = await props.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const value = search[key];
    if (typeof value === "string") params.set(key, value);
  }

  const db = getDb();
  const creator = await requireCreator(db, `/add?${params.toString()}`);
  const parsed = parseHandoff(params);

  if (!parsed.ok) {
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle title="That link didn't work" />
        <Card>
          <p className="text-bad">{parsed.errors.join(" ")}</p>
          <p className="mt-2 text-sm text-muted">Ask your agent for the guest&apos;s link again, or add them by hand on the episode page.</p>
        </Card>
      </div>
    );
  }

  const episodes = (await listEpisodes(db, creator.id)).map((e) => ({ id: e.id, topic: e.topic }));
  const forward = Object.fromEntries([...params.entries()].filter(([key]) => key !== "ep"));

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title={`Add ${parsed.guest.name} to your desk?`} subtitle="From your Agent Village agent. Check it, then add." />
      <Card className="space-y-4">
        <div>
          <p className="text-lg font-medium">{parsed.guest.name}</p>
          {parsed.guest.lookingToMeet ? (
            <p className="text-sm text-muted">Looking to meet: {parsed.guest.lookingToMeet}</p>
          ) : null}
          <ul className="mt-2 space-y-1 text-sm">
            {parsed.guest.links.map((link) => (
              <li key={link}>
                <a href={link} target="_blank" rel="noreferrer" className="text-brand underline">
                  {link}
                </a>
              </li>
            ))}
          </ul>
          {parsed.topic ? <Badge>{parsed.topic}</Badge> : null}
          {parsed.warnings.map((w) => (
            <p key={w} className="mt-2 text-xs text-warn">{w}</p>
          ))}
        </div>
        <ConfirmHandoff params={forward} episodes={episodes} defaultEpisodeId={parsed.episodeId} />
      </Card>
    </div>
  );
}
