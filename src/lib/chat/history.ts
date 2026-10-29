import type { UIMessage } from "ai";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { chatMessages } from "@/lib/db/schema";

const KEEP = 30;
// One row holds a whole conversation, so message order is exactly what the client had.
const ROLE = "conversation";

const scope = (creatorId: string, guestId: string | null) =>
  and(
    eq(chatMessages.creatorId, creatorId),
    guestId ? eq(chatMessages.guestId, guestId) : isNull(chatMessages.guestId),
    eq(chatMessages.role, ROLE),
  );

export async function loadChat(db: Db, creatorId: string, guestId: string | null): Promise<UIMessage[]> {
  const [row] = await db.select().from(chatMessages).where(scope(creatorId, guestId)).limit(1);
  return (row?.content as UIMessage[] | undefined) ?? [];
}

export async function saveChat(db: Db, creatorId: string, guestId: string | null, messages: UIMessage[]): Promise<void> {
  const kept = messages.slice(-KEEP);
  await db.transaction(async (tx) => {
    await tx.delete(chatMessages).where(scope(creatorId, guestId));
    await tx.insert(chatMessages).values({ creatorId, guestId, role: ROLE, content: kept });
  });
}
