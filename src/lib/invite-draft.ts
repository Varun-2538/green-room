import { generateText, type LanguageModel, Output } from "ai";
import { z } from "zod";
import { lowReasoning } from "@/lib/ai/model";
import type { Brief } from "@/lib/brief";

export type InviteTone = "warm" | "brief" | "playful";

export type DraftInput = {
  showName: string;
  showPitch?: string;
  creatorName: string;
  guestName: string;
  brief: Brief | null;
  lookingToMeet?: string;
  tone: InviteTone;
  note?: string;
};

const MAX_MESSAGE = 1200;

const TONES: Record<InviteTone, string> = {
  warm: "warm and personal, like a note from a friend of a friend",
  brief: "short and direct: four sentences at most",
  playful: "light and playful, with one small joke at most",
};

const SYSTEM = `You write podcast guest invitations on behalf of a host.
Write in the host's voice, first person, plain English, no hype, no emojis, no hashtags.
Mention one or two specific things about the guest's public work, taken only from the facts given.
Say why this guest fits this show and what is in it for them.
Never claim facts that are not in the input. Do not mention how the host found the guest.
Do not include links, dates, or times; the invite card shows times separately.
Also write a one-line episode angle (under 15 words).`;

const draftSchema = z.object({ message: z.string(), angle: z.string() });

export async function draftInvite(i: DraftInput, deps: { model: LanguageModel }): Promise<{ message: string; angle: string }> {
  const facts = i.brief?.facts.map((f) => `- ${f.text}`).join("\n") ?? "";
  const { output } = await generateText({
    model: deps.model,
    instructions: SYSTEM,
    output: Output.object({ schema: draftSchema }),
    providerOptions: lowReasoning,
    prompt: [
      `Host: ${i.creatorName}`,
      `Show: ${i.showName}${i.showPitch ? ` (${i.showPitch})` : ""}`,
      `Guest: ${i.guestName}`,
      `Tone: ${TONES[i.tone]}`,
      i.brief ? `Guest's story: ${i.brief.story}` : "",
      facts ? `Facts about the guest:\n${facts}` : "",
      i.lookingToMeet ? `What the guest says they want to meet people for: ${i.lookingToMeet}` : "",
      i.note ? `Host's note for this invite: ${i.note}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return { message: output.message.trim().slice(0, MAX_MESSAGE), angle: output.angle.trim() };
}
