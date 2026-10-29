// Chat apps fetch a link the moment it is pasted to build a preview; those fetches are not the guest opening it.
const PREVIEW_BOT = /bot\b|bot\/|crawler|spider|facebookexternalhit|whatsapp|slack|embedly|preview/i;

export function isLinkPreviewBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return PREVIEW_BOT.test(userAgent);
}
