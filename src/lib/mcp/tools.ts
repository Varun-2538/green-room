import type { LanguageModel } from "ai";
import { z } from "zod";
import { buildBrief } from "@/lib/brief";
import type { tinyfishFetch, tinyfishSearch } from "@/lib/tinyfish";

/** Public inputs only: a name, public https links and a topic. Never Mosaic page content. */
export const guestInputSchema = z.object({
  name: z.string().trim().min(1).max(120).describe("The guest's public name"),
  links: z
    .array(z.url({ protocol: /^https$/ }).max(500))
    .max(5)
    .describe("Up to 5 public https links from the guest's Rolodex profile"),
  topic: z.string().trim().min(1).max(200).describe("The episode topic"),
});
export type GuestInput = z.infer<typeof guestInputSchema>;

export type McpDeps = {
  search: typeof tinyfishSearch;
  fetchPages: typeof tinyfishFetch;
  model: LanguageModel;
  limiter: () => Promise<{ allowed: boolean; retryAfterSec: number }>;
};

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const text = (value: unknown, isError = false): ToolResult => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
  ...(isError ? { isError } : {}),
});

async function brief(input: GuestInput, deps: McpDeps) {
  return buildBrief({ ...input, showName: "the host's show" }, deps);
}

async function guarded(deps: McpDeps, run: () => Promise<ToolResult>): Promise<ToolResult> {
  const limit = await deps.limiter();
  if (!limit.allowed) return text(`Rate limit reached. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.`, true);
  try {
    return await run();
  } catch {
    return text("Green Room could not research this guest just now. Try once more later.", true);
  }
}

export function runGuestBrief(input: GuestInput, deps: McpDeps): Promise<ToolResult> {
  return guarded(deps, async () => text(await brief(input, deps)));
}

export function runEpisodeQuestions(input: GuestInput, deps: McpDeps): Promise<ToolResult> {
  return guarded(deps, async () => text({ questions: (await brief(input, deps)).questions }));
}
