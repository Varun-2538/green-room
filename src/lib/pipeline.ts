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

/** The desk board: four lanes that fit on one screen. Each card names its exact stage. */
export const PIPELINE_LANES: { title: string; statuses: GuestStatus[] }[] = [
  { title: "Preparing", statuses: ["shortlisted", "brief_ready", "drafted"] },
  { title: "Invited", statuses: ["invited", "opened"] },
  { title: "Said yes", statuses: ["accepted", "time_suggested"] },
  { title: "Done", statuses: ["recorded", "declined"] },
];

export const STAGE_LABEL: Record<GuestStatus, string> = {
  shortlisted: "Shortlisted",
  brief_ready: "Brief ready",
  drafted: "Invite drafted",
  invited: "Not opened yet",
  opened: "Opened",
  accepted: "Booked",
  time_suggested: "Suggested a time",
  declined: "Declined",
  recorded: "Recorded",
};

export function laneFor(status: GuestStatus) {
  const lane = PIPELINE_LANES.find((l) => l.statuses.includes(status));
  if (!lane) throw new Error(`No lane for ${status}`);
  return lane;
}
