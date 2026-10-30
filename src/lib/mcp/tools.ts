import type { LanguageModel } from "ai";
import { z } from "zod";
import { buildBrief } from "@/lib/brief";
import type { tinyfishFetch, tinyfishSearch } from "@/lib/tinyfish";

/** Public inputs only: a name, public https links and a topic. Never Mosaic page content. */
export const guestInputSchema = z.strictObject({
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
  /** Answer before Agent Village gives up on the call (its ceiling is 25 s). */
  deadlineMs?: number;
};

const DEFAULT_DEADLINE_MS = 22_000;

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (value: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

/** Edge City's error contract: an isError result whose one text item is exactly {code, detail}. */
const fail = (code: "rate_limited" | "unavailable", detail: string): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify({ code, detail }) }],
  isError: true,
});

async function brief(input: GuestInput, deps: McpDeps) {
  return buildBrief({ ...input, showName: "the host's show" }, deps);
}

async function guarded(deps: McpDeps, run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    const limit = await deps.limiter();
    if (!limit.allowed) {
      return fail(
        "rate_limited",
        `Too many guest briefs from this network right now. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.`,
      );
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("deadline")), deps.deadlineMs ?? DEFAULT_DEADLINE_MS);
    });
    try {
      return await Promise.race([run(), deadline]);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return fail("unavailable", "Green Room could not research this guest just now. Try once more later.");
  }
}

export function runGuestBrief(input: GuestInput, deps: McpDeps): Promise<ToolResult> {
  return guarded(deps, async () => ok(await brief(input, deps)));
}

export function runEpisodeQuestions(input: GuestInput, deps: McpDeps): Promise<ToolResult> {
  return guarded(deps, async () => ok({ questions: (await brief(input, deps)).questions }));
}
