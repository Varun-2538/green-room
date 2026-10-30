import { redirect } from "next/navigation";
import { Badge, Card, PageTitle } from "@/components/ui";
import { VerifyWithWorld } from "@/components/VerifyWithWorld";
import { safeNextPath } from "@/lib/auth/redirect";
import { requireCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { WORLD_ACTION } from "@/lib/worldid/verify";

export default async function VerifyPage(props: PageProps<"/verify">) {
  const search = await props.searchParams;
  const next = safeNextPath(typeof search.next === "string" ? search.next : null, "/desk");
  const creator = await requireCreator(getDb(), "/verify");
  if (creator.verifiedAt) redirect(next);

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Prove you're a real person" subtitle="Guests see a verified badge on every invite you send." />
      <Card className="space-y-4">
        <p>
          Optional, and one verification per person. It proves you&apos;re a real, unique human; we never see your name or
          face. Guests see the badge on your invites, so they know a real person is asking.
        </p>
        <Badge tone="good">✓ Verified human · World ID</Badge>
        <VerifyWithWorld
          appId={env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`}
          rpId={env.NEXT_PUBLIC_WORLD_RP_ID}
          action={WORLD_ACTION}
          next={next}
        />
      </Card>
    </div>
  );
}
