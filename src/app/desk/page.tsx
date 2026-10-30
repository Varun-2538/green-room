import Link from "next/link";
import { DeskChat } from "@/components/DeskChat";
import { NewEpisodeForm } from "@/components/forms";
import { Onboarding } from "@/components/Onboarding";
import { PipelineBoard } from "@/components/PipelineBoard";
import { Badge, Card, PageTitle } from "@/components/ui";
import { requireCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { loadChat } from "@/lib/chat/history";
import { env } from "@/lib/env";
import { listEpisodes } from "@/lib/episodes";
import { listAllGuests } from "@/lib/guests";
import { needsOnboarding } from "@/lib/onboarding";
import { WORLD_ACTION } from "@/lib/worldid/verify";

export default async function DeskPage() {
  const db = getDb();
  const creator = await requireCreator(db, "/desk");
  const [episodes, guests, chat] = await Promise.all([
    listEpisodes(db, creator.id),
    listAllGuests(db, creator.id),
    loadChat(db, creator.id, null),
  ]);

  // First visit: one question at a time. Once the show has a name, the desk takes its place.
  if (needsOnboarding(creator)) {
    return (
      <Onboarding
        firstName={creator.name.split(" ").find((w) => /\p{L}/u.test(w)) ?? creator.name}
        verified={Boolean(creator.verifiedAt)}
        episodeCount={episodes.length}
        world={{ appId: env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`, rpId: env.NEXT_PUBLIC_WORLD_RP_ID, action: WORLD_ACTION }}
      />
    );
  }

  const booked = guests.filter((g) => g.status === "accepted" || g.status === "recorded").length;

  return (
    <div className="rise-in space-y-8">
      <PageTitle
        title={`${creator.showName} · booking desk`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {creator.verifiedAt ? <Badge tone="good">✓ Verified human</Badge> : <Link href="/verify" className="text-brand underline">Verify with World ID to send invites</Link>}
            <span>
              {guests.length} guest{guests.length === 1 ? "" : "s"} · {booked} booked
            </span>
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
                  <span className="text-sm text-muted">
                    {e.guestCount} guest{e.guestCount === 1 ? "" : "s"}
                  </span>
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

      <Card className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Ask Green Room</h2>
        <DeskChat
          initialMessages={chat}
          suggestions={["Who said yes?", "Who hasn't answered yet?", "Who is ready to invite next?", "Which episode needs more guests?", "How many invites can I send today?"]}
        />
      </Card>
    </div>
  );
}
