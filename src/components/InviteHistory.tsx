import { Badge } from "@/components/ui";
import type { Invite } from "@/lib/db/schema";

const ANSWER = {
  accepted: { label: "Said yes", tone: "good" },
  time_suggested: { label: "Suggested a time", tone: "warn" },
  declined: { label: "Not now", tone: "bad" },
} as const;

const when = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** What happened to each invite sent to this guest, including the guest's own note or suggested time. */
export function InviteHistory({ invites, appUrl }: { invites: Invite[]; appUrl: string }) {
  if (invites.length === 0) return null;
  return (
    <ul className="divide-y divide-line text-sm">
      {invites.map((invite) => {
        const answer = invite.answer ? ANSWER[invite.answer] : null;
        return (
          <li key={invite.id} className="space-y-1 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {answer ? <Badge tone={answer.tone}>{answer.label}</Badge> : <Badge>{invite.openedAt ? "Opened" : "Not opened yet"}</Badge>}
              <span className="text-muted">sent {when(invite.createdAt)}</span>
              {invite.openedAt ? <span className="text-muted">· opened {when(invite.openedAt)}</span> : null}
              {invite.answeredAt ? <span className="text-muted">· answered {when(invite.answeredAt)}</span> : null}
              <a href={`${appUrl}/i/${invite.code}`} target="_blank" rel="noreferrer" className="text-brand underline">
                card
              </a>
            </div>
            {invite.answerNote ? (
              <p className="rounded-xl bg-background p-2">
                <span className="text-muted">Their note:</span> {invite.answerNote}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
