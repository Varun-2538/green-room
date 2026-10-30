import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AnswerButtons, type ViewerState } from "@/components/AnswerButtons";
import { Badge, Card } from "@/components/ui";
import { currentCreator } from "@/lib/auth/session";
import { isLinkPreviewBot } from "@/lib/bots";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { inviteMetadata } from "@/lib/invite-metadata";
import { getInviteByCode, markOpened } from "@/lib/invites";

const CODE = /^[A-Za-z0-9_-]{12}$/;

export async function generateMetadata(props: PageProps<"/i/[code]">): Promise<Metadata> {
  const { code } = await props.params;
  return inviteMetadata(CODE.test(code) ? await getInviteByCode(getDb(), code) : null);
}

export default async function InvitePage(props: PageProps<"/i/[code]">) {
  const { code } = await props.params;
  if (!CODE.test(code)) notFound();
  const db = getDb();
  const card = await getInviteByCode(db, code);
  if (!card) notFound();

  const viewer = await currentCreator(db);
  const userAgent = (await headers()).get("user-agent");
  if (!isLinkPreviewBot(userAgent)) await markOpened(db, code, viewer?.id ?? null);

  // Who is looking decides what they can do: answering needs a Telegram login, and the first person to
  // answer claims the invite. Others never see the answer or who gave it.
  const viewerState: ViewerState = !viewer
    ? "anonymous"
    : viewer.id === card.creatorId
      ? "creator"
      : card.answeredBy && card.answeredBy.telegramId !== viewer.telegramId
        ? "claimed"
        : "guest";
  const isClaimant = viewerState === "guest" && card.answeredBy?.telegramId === viewer?.telegramId;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card className="space-y-5">
        <div className="flex items-center gap-3">
          {card.creatorPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Telegram-hosted avatar, any host
            <img src={card.creatorPhotoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand font-display text-xl text-brand-ink">
              {card.creatorName.slice(0, 1)}
            </div>
          )}
          <div>
            <p className="font-medium">{card.creatorName}</p>
            {card.verified ? <Badge tone="good">✓ Verified human · World ID</Badge> : <Badge>Not verified</Badge>}
          </div>
        </div>

        <div>
          <p className="text-sm uppercase tracking-widest text-accent">You&apos;re invited to</p>
          <h1 className="font-display text-3xl font-semibold text-brand">{card.showName}</h1>
          {card.showPitch ? <p className="text-muted">{card.showPitch}</p> : null}
        </div>

        <p className="whitespace-pre-wrap leading-relaxed">{card.message}</p>

        {card.angle ? (
          <p className="rounded-xl bg-background p-3 text-sm">
            <span className="font-medium">Episode idea:</span> {card.angle}
          </p>
        ) : null}

        <AnswerButtons
          code={card.code}
          appUrl={env.NEXT_PUBLIC_APP_URL}
          showName={card.showName}
          creatorName={card.creatorName}
          guestName={card.guestName}
          angle={card.angle}
          timeOptions={card.timeOptions}
          viewerState={viewerState}
          loginHref={`/api/auth/telegram/start?next=${encodeURIComponent(`/i/${card.code}`)}`}
          initialAnswer={isClaimant ? card.answer : undefined}
          initialSlot={isClaimant ? card.chosenSlot : null}
        />
      </Card>
      <p className="text-center text-xs text-muted">
        Sent with Green Room · {card.verified ? "World ID confirms the sender is a real, unique person." : "This sender hasn't verified yet."}
      </p>
    </div>
  );
}
