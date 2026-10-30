import type { Metadata } from "next";

type CardBits = { creatorName: string; showName: string; angle: string };

const NEUTRAL = "An invitation to be a guest on a show.";

/**
 * Metadata for the public invite card. It always sets its own description, so the site-wide
 * description (written for creators, and mentioning Mosaic) never reaches a guest or a link preview.
 */
export function inviteMetadata(card: CardBits | null): Metadata {
  if (!card) return { title: "An invitation", description: NEUTRAL };
  const title = `${card.creatorName} invites you to ${card.showName}`;
  const description = card.angle || NEUTRAL;
  return { title, description, openGraph: { title, description } };
}
