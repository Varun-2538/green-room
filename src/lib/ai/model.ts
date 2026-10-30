import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { env } from "@/lib/env";

/** An open model hosted on Groq. The model id comes from GROQ_MODEL so it can change without a code change. */
export function getModel(): LanguageModel {
  return createGroq({ apiKey: env.GROQ_API_KEY })(env.GROQ_MODEL);
}

/** Keep reasoning short: briefs and drafts are summarising, not solving. */
export const lowReasoning = { groq: { reasoningEffort: "low" as const } };
