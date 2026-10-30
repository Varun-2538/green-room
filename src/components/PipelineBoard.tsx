import Link from "next/link";
import { markRecordedAction } from "@/app/actions";
import type { GuestWithEpisode } from "@/lib/guests";
import { PIPELINE_LANES, STAGE_LABEL } from "@/lib/pipeline";

const STAGE_TONE: Partial<Record<GuestWithEpisode["status"], string>> = {
  accepted: "text-good",
  time_suggested: "text-warn",
  declined: "text-bad",
  recorded: "text-good",
};

export function PipelineBoard({ guests }: { guests: GuestWithEpisode[] }) {
  if (guests.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">
        No guests yet. Open an episode, then ask your agent for guests.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PIPELINE_LANES.map((lane) => {
        const cards = guests.filter((g) => lane.statuses.includes(g.status));
        return (
          <div key={lane.title} className="min-w-0 rounded-2xl bg-background/60 p-2">
            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {lane.title} · {cards.length}
            </p>
            <div className="space-y-2">
              {cards.map((g) => (
                <div key={g.id} className="rounded-xl border border-line bg-surface p-3 text-sm shadow-sm">
                  <Link href={`/guest/${g.id}`} className="font-medium hover:text-brand">
                    {g.name}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{g.episodeTopic}</p>
                  <p className={`mt-1 text-xs font-medium ${STAGE_TONE[g.status] ?? "text-muted"}`}>{STAGE_LABEL[g.status]}</p>
                  {g.status === "accepted" ? (
                    <form action={markRecordedAction} className="mt-2">
                      <input type="hidden" name="guestId" value={g.id} />
                      <button className="text-xs font-medium text-brand underline-offset-2 hover:underline">
                        Mark recorded
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
              {cards.length === 0 ? <p className="px-1 pb-1 text-xs text-muted/70">Nobody here yet</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
