import Link from "next/link";
import { notFound } from "next/navigation";
import { AddGuestForm } from "@/components/AddGuest";
import { AskMyAgent } from "@/components/AskMyAgent";
import { Badge, Card, PageTitle } from "@/components/ui";
import { env } from "@/lib/env";
import { agentDeepLink, buildAgentPrompt } from "@/lib/handoff";
import { requireCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getEpisode } from "@/lib/episodes";
import { listGuests } from "@/lib/guests";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EpisodePage(props: PageProps<"/episode/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const db = getDb();
  const creator = await requireCreator(db, `/episode/${id}`);
  const episode = await getEpisode(db, creator.id, id);
  if (!episode) notFound();
  const guests = await listGuests(db, creator.id, episode.id);
  const prompt = buildAgentPrompt({
    showName: creator.showName ?? "my show",
    topic: episode.topic,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    episodeId: episode.id,
  });

  return (
    <div className="space-y-6">
      <PageTitle title={episode.topic} subtitle={<Link href="/desk" className="underline">← Desk</Link>} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Ask my agent</h2>
          <AskMyAgent
            prompt={prompt}
            deepLink={agentDeepLink(creator.agentUsername, prompt)}
            agentUsername={creator.agentUsername}
          />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Add a guest by hand</h2>
          <AddGuestForm episodeId={episode.id} />
        </Card>
      </div>

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Guests</h2>
        {guests.length === 0 ? (
          <p className="text-muted">No guests yet for this episode.</p>
        ) : (
          <ul className="divide-y divide-line">
            {guests.map((g) => (
              <li key={g.id}>
                <Link href={`/guest/${g.id}`} className="flex items-center justify-between py-3 hover:text-brand">
                  <span className="font-medium">{g.name}</span>
                  <Badge>{g.status.replace("_", " ")}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
