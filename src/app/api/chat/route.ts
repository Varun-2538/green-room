import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getModel, lowReasoning } from "@/lib/ai/model";
import { currentCreator } from "@/lib/auth/session";
import { forModel, saveChat } from "@/lib/chat/history";
import { deskTools } from "@/lib/chat/tools";
import { getDb } from "@/lib/db/client";
import { getGuest } from "@/lib/guests";
import { checkRateLimit } from "@/lib/ratelimit";
import { tinyfishFetch, tinyfishSearch } from "@/lib/tinyfish";

export const maxDuration = 60;

const body = z.object({
  messages: z.array(z.looseObject({ id: z.string(), role: z.enum(["user", "assistant", "system"]) })).min(1).max(60),
  guestId: z.uuid().nullish(),
});

function instructions(showName: string, guestName?: string) {
  return `You are Green Room, a booking assistant for the show "${showName}".
Help the host find the right angle, prepare for guests and draft invites.
Use your tools for every fact about the pipeline or a guest, and call them again on every question: earlier answers may be out of date. Never invent facts about a guest; when you state one, cite the brief's source.
You cannot create or send invites, or message anyone: the host creates a verified invite with their own click in the invite builder, and sends it in Telegram.
Never ask for or repeat anything from the host's Mosaic pair pages.
Keep replies short, in plain text: no markdown such as ** or #. Use "- " for lists. Describe where each guest is with the stage and lane the tools give.${guestName ? `\nThis conversation is about the guest ${guestName}. The tools already know who that is: leave guestId out.` : ""}`;
}

export async function POST(request: Request) {
  const db = getDb();
  const creator = await currentCreator(db);
  if (!creator) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad chat request." }, { status: 400 });
  const messages = parsed.data.messages as unknown as UIMessage[];
  const guestId = parsed.data.guestId ?? null;

  const guest = guestId ? await getGuest(db, creator.id, guestId) : null;
  if (guestId && !guest) return NextResponse.json({ error: "Unknown guest." }, { status: 404 });

  const limit = await checkRateLimit(db, `chat:${creator.id}`, 60, 3600);
  if (!limit.allowed) return NextResponse.json({ error: "Chat limit reached for this hour." }, { status: 429 });

  const model = getModel();
  const tools = deskTools({
    db,
    creator,
    model,
    search: tinyfishSearch,
    fetchPages: tinyfishFetch,
    ...(guest ? { guestId: guest.id } : {}),
  });
  const result = streamText({
    model,
    instructions: instructions(creator.showName ?? "my show", guest?.name),
    messages: await convertToModelMessages(forModel(messages.slice(-30))),
    tools,
    stopWhen: isStepCount(5),
    providerOptions: lowReasoning,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      onFinish: async ({ messages: all }) => {
        await saveChat(db, creator.id, guestId, all);
      },
    }),
  });
}
