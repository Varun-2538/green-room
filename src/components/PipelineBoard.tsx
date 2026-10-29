import Link from "next/link";
import { markRecordedAction } from "@/app/actions";
import type { GuestWithEpisode } from "@/lib/guests";
import { PIPELINE_COLUMNS } from "@/lib/pipeline";

const STATUS_LABEL: Record<string, string> = { time_suggested: "suggested a time", accepted: "said yes" };

export function PipelineBoard({ guests }: { guests: GuestWithEpisode[] }) {
  if (guests.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">
        No guests yet. Create an episode, then ask your agent for guests.
      </p>
    );
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {PIPELINE_COLUMNS.map((column) => {
        const cards = guests.filter((g) => column.statuses.includes(g.status));
        return (
          <div key={column.title} className="w-52 shrink-0 rounded-2xl bg-background/60 p-2">
            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {column.title} · {cards.length}
            </p>
            <div className="space-y-2">
              {cards.map((g) => (
                <div key={g.id} className="rounded-xl border border-line bg-surface p-3 text-sm shadow-sm">
                  <Link href={`/guest/${g.id}`} className="font-medium hover:text-brand">
                    {g.name}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{g.episodeTopic}</p>
                  {STATUS_LABEL[g.status] ? <p className="mt-1 text-xs text-good">{STATUS_LABEL[g.status]}</p> : null}
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
