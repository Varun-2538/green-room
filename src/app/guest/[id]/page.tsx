import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefPanel } from "@/components/BriefPanel";
import { Badge, Card, PageTitle } from "@/components/ui";
import { requireCreator } from "@/lib/auth/session";
import { getLatestBrief } from "@/lib/brief";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { getGuest } from "@/lib/guests";
import { DAILY_INVITE_LIMIT, invitesLeftToday, listInvitesForGuest } from "@/lib/invites";
import { InviteBuilder } from "@/components/InviteBuilder";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GuestPage(props: PageProps<"/guest/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const db = getDb();
  const creator = await requireCreator(db, `/guest/${id}`);
  const guest = await getGuest(db, creator.id, id);
  if (!guest) notFound();
  const [brief, invitesLeft, invites] = await Promise.all([
    getLatestBrief(db, guest.id),
    invitesLeftToday(db, creator.id),
    listInvitesForGuest(db, creator.id, guest.id),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle
        title={guest.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/episode/${guest.episodeId}`} className="underline">{guest.episodeTopic}</Link>
            <Badge>{guest.status.replace("_", " ")}</Badge>
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Guest brief</h2>
          <BriefPanel guestId={guest.id} initial={brief} />
        </Card>

        <Card className="space-y-3 lg:col-span-2 lg:row-start-2">
          <h2 className="font-display text-xl font-semibold">Invite</h2>
          <InviteBuilder
            guestId={guest.id}
            guestName={guest.name}
            verified={Boolean(creator.verifiedAt)}
            invitesLeft={invitesLeft}
            dailyLimit={DAILY_INVITE_LIMIT}
            existingUrls={invites.map((i) => `${env.NEXT_PUBLIC_APP_URL}/i/${i.code}`)}
          />
        </Card>

        <Card className="space-y-3 lg:row-start-1">
          <h2 className="font-display text-xl font-semibold">About</h2>
          {guest.lookingToMeet ? <p className="text-sm"><span className="text-muted">Looking to meet:</span> {guest.lookingToMeet}</p> : null}
          {guest.creatorNote ? <p className="text-sm"><span className="text-muted">Your note:</span> {guest.creatorNote}</p> : null}
          <ul className="space-y-1 text-sm">
            {guest.links.map((link) => (
              <li key={link}><a href={link} target="_blank" rel="noreferrer" className="text-brand underline">{link}</a></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
