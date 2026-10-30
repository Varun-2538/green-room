import { createMcpHandler } from "mcp-handler";
import { getModel } from "@/lib/ai/model";
import { getDb } from "@/lib/db/client";
import { guestInputSchema, type McpDeps, runEpisodeQuestions, runGuestBrief } from "@/lib/mcp/tools";
import { checkRateLimit } from "@/lib/ratelimit";
import { tinyfishFetch, tinyfishSearch } from "@/lib/tinyfish";

export const maxDuration = 60;

// Public, read-only, no auth: the green-room mini-app's tools. 30 calls per IP per hour protects paid upstreams.
function handlerFor(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const deps: McpDeps = {
    // Agent Village gives a generic app 25 s: search, fetch and the model must all fit inside it.
    search: (query, o) => tinyfishSearch(query, { ...o, timeoutMs: 6_000 }),
    fetchPages: (urls, o) => tinyfishFetch(urls, { ...o, perUrlTimeoutMs: 8_000, timeoutMs: 10_000 }),
    model: getModel(),
    limiter: () => checkRateLimit(getDb(), `mcp:${ip}`, 30, 3600),
  };
  return createMcpHandler((server) => {
    server.registerTool(
      "guest_brief",
      {
        title: "Guest brief",
        description:
          "Research a podcast guest's public work (from their public name and links) and return their story, sourced facts, recent work and 8 interview questions. Public inputs only.",
        inputSchema: guestInputSchema,
      },
      (input) => runGuestBrief(input, deps),
    );
    server.registerTool(
      "episode_questions",
      {
        title: "Episode questions",
        description: "Return 8 journey-focused interview questions for a guest, researched from their public name and links.",
        inputSchema: guestInputSchema,
      },
      (input) => runEpisodeQuestions(input, deps),
    );
  });
}

export function GET(request: Request) {
  return handlerFor(request)(request);
}

export function POST(request: Request) {
  return handlerFor(request)(request);
}

export function DELETE(request: Request) {
  return handlerFor(request)(request);
}
