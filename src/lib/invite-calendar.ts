import type { CalendarEvent } from "@/lib/calendar";
import type { InviteAnswer, TimeSlot } from "@/lib/db/schema";

type CardBits = {
  code: string;
  showName: string;
  creatorName: string;
  guestName: string;
  angle: string;
  answer?: InviteAnswer;
  timeOptions: TimeSlot[];
  chosenSlot: number | null;
};

const RECORDING_MINUTES = 60;

/** The calendar event for an accepted invite at the slot the guest picked, or null before that. */
export function inviteEvent(card: CardBits, appUrl: string): CalendarEvent | null {
  if (card.answer !== "accepted" || card.chosenSlot === null) return null;
  const slot = card.timeOptions[card.chosenSlot];
  if (!slot) return null;
  const url = `${appUrl}/i/${card.code}`;
  return {
    uid: `${card.code}@green-room`,
    title: `${card.showName}: recording with ${card.creatorName} and ${card.guestName}`,
    description: [card.angle ? `Episode idea: ${card.angle}` : "", `Invite: ${url}`].filter(Boolean).join("\n"),
    start: new Date(slot.start),
    durationMinutes: RECORDING_MINUTES,
    ...(slot.place ? { location: slot.place } : {}),
    url,
  };
}
