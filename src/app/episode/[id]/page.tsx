import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageTitle } from "@/components/ui";
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

  return (
    <div className="space-y-6">
      <PageTitle title={episode.topic} subtitle={<Link href="/desk" className="underline">← Desk</Link>} />

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
