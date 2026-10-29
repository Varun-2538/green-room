import Link from "next/link";
import { NewEpisodeForm } from "@/components/forms";
import { PipelineBoard } from "@/components/PipelineBoard";
import { Badge, Card, PageTitle } from "@/components/ui";
import { requireCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listEpisodes } from "@/lib/episodes";
import { listAllGuests } from "@/lib/guests";

export default async function DeskPage() {
  const db = getDb();
  const creator = await requireCreator(db, "/desk");
  const [episodes, guests] = await Promise.all([listEpisodes(db, creator.id), listAllGuests(db, creator.id)]);

  return (
    <div className="space-y-8">
      <PageTitle
        title={creator.showName ? `${creator.showName} · booking desk` : "Your booking desk"}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {creator.verifiedAt ? <Badge tone="good">✓ Verified human</Badge> : <Link href="/verify" className="text-brand underline">Verify with World ID to send invites</Link>}
            {!creator.showName ? <Link href="/settings" className="text-brand underline">Name your show</Link> : null}
          </span>
        }
      />

      <Card className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Episodes</h2>
        <NewEpisodeForm />
        {episodes.length > 0 ? (
          <ul className="divide-y divide-line">
            {episodes.map((e) => (
              <li key={e.id}>
                <Link href={`/episode/${e.id}`} className="flex items-center justify-between py-3 hover:text-brand">
                  <span>{e.topic}</span>
                  <span className="text-sm text-muted">{e.guestCount} guests</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Pipeline</h2>
        <PipelineBoard guests={guests} />
      </section>
    </div>
  );
}
