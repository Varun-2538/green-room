import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import { env } from "@/lib/env";

/** Grok via xAI. The model id comes from XAI_MODEL so it can change without a deploy of code. */
export function getModel(): LanguageModel {
  return createXai({ apiKey: env.XAI_API_KEY })(env.XAI_MODEL);
}

/** Keep reasoning short: briefs and drafts are summarising, not solving. */
export const lowReasoning = { xai: { reasoningEffort: "low" as const } };
