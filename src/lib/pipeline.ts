import type { GuestStatus } from "@/lib/db/schema";

export type { GuestStatus };

export type PipelineEvent =
  | "brief_built"
  | "invite_drafted"
  | "invite_created"
  | "invite_opened"
  | "answered_accepted"
  | "answered_time"
  | "answered_declined"
  | "marked_recorded";

const RANK: Record<GuestStatus, number> = {
  shortlisted: 0,
  brief_ready: 1,
  drafted: 2,
  invited: 3,
  opened: 4,
  accepted: 5,
  time_suggested: 5,
  declined: 5,
  recorded: 6,
};

const ANSWER: Partial<Record<PipelineEvent, GuestStatus>> = {
  answered_accepted: "accepted",
  answered_time: "time_suggested",
  answered_declined: "declined",
};

/**
 * Moves a guest forward through the booking pipeline. Events never move a guest backwards,
 * except that a guest may change their answer; events that do not apply yet are ignored.
 */
export function applyEvent(status: GuestStatus, event: PipelineEvent): GuestStatus {
  const rank = RANK[status];
  switch (event) {
    case "brief_built":
      return rank < RANK.brief_ready ? "brief_ready" : status;
    case "invite_drafted":
      return rank < RANK.drafted ? "drafted" : status;
    case "invite_created":
      return rank < RANK.invited ? "invited" : status;
    case "invite_opened":
      return status === "invited" ? "opened" : status;
    case "marked_recorded":
      return status === "accepted" ? "recorded" : status;
    default: {
      const answer = ANSWER[event];
      return answer && rank >= RANK.invited && rank <= RANK.accepted ? answer : status;
    }
  }
}

export const PIPELINE_COLUMNS: { title: string; statuses: GuestStatus[] }[] = [
  { title: "Shortlisted", statuses: ["shortlisted"] },
  { title: "Brief ready", statuses: ["brief_ready"] },
  { title: "Drafted", statuses: ["drafted"] },
  { title: "Invited", statuses: ["invited"] },
  { title: "Opened", statuses: ["opened"] },
  { title: "Said yes", statuses: ["accepted", "time_suggested"] },
  { title: "Declined", statuses: ["declined"] },
  { title: "Recorded", statuses: ["recorded"] },
];
