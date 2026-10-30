import { describe, expect, it, vi } from "vitest";
import { guestInputSchema, runEpisodeQuestions, runGuestBrief } from "@/lib/mcp/tools";
import { mockJsonModel } from "./helpers/ai";

const brief = { story: "Hosts street interviews about dreams.", recentWork: [], questions: ["Q1?", "Q2?"], facts: [] };

function deps(allowed = true) {
  const ai = mockJsonModel(brief);
  return {
    search: vi.fn(async () => [{ position: 1, title: "T", url: "https://arun.example", snippet: "dreams" }]),
    fetchPages: vi.fn(async () => ({ pages: [], failed: [] })),
    model: ai.model,
    limiter: vi.fn(async () => ({ allowed, retryAfterSec: allowed ? 0 : 120 })),
  };
}

const ok = { name: "Arun", links: ["https://arun.example"], topic: "dreams" };

describe("guestInputSchema", () => {
  it("accepts a public name, https links and a topic", () => {
    expect(guestInputSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects http links", () => {
    expect(guestInputSchema.safeParse({ ...ok, links: ["http://arun.example"] }).success).toBe(false);
  });

  it("rejects more than 5 links", () => {
    const links = Array.from({ length: 6 }, (_, i) => `https://s${i}.example`);
    expect(guestInputSchema.safeParse({ ...ok, links }).success).toBe(false);
  });
});

describe("MCP tools", () => {
  it("guest_brief returns the brief as JSON text", async () => {
    const result = await runGuestBrief(ok, deps());
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text).story).toContain("Hosts street interviews about dreams.");
  });

  it("guest_brief refuses when the rate limit is reached, without researching", async () => {
    const d = deps(false);
    const result = await runGuestBrief(ok, d);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Rate limit reached");
    expect(d.search).not.toHaveBeenCalled();
  });

  it("episode_questions returns exactly 8 questions", async () => {
    const result = await runEpisodeQuestions(ok, deps());
    expect(JSON.parse(result.content[0].text).questions).toHaveLength(8);
  });
});
