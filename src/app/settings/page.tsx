import { SettingsForm } from "@/components/forms";
import { Card, PageTitle } from "@/components/ui";
import { requireCreator } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export default async function SettingsPage() {
  const creator = await requireCreator(getDb(), "/settings");
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Settings" subtitle="Guests see your show name and pitch on every invite." />
      <Card>
        <SettingsForm
          showName={creator.showName ?? ""}
          showPitch={creator.showPitch ?? ""}
          agentUsername={creator.agentUsername}
        />
      </Card>
    </div>
  );
}
