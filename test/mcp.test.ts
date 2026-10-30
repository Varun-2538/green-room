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

  it("rejects unknown arguments, so nothing beyond public name, links and topic is accepted", () => {
    expect(guestInputSchema.safeParse({ ...ok, why: "mosaic overlap" }).success).toBe(false);
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
    expect(JSON.parse(result.content[0].text)).toEqual({
      code: "rate_limited",
      detail: "Too many guest briefs from this network right now. Try again in 2 min.",
    });
    expect(d.search).not.toHaveBeenCalled();
  });

  it("returns {code: unavailable} when research fails outright", async () => {
    const d = { ...deps(), model: undefined as never };
    const result = await runGuestBrief(ok, d);
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({
      code: "unavailable",
      detail: "Green Room could not research this guest just now. Try once more later.",
    });
  });

  it("returns {code: unavailable} when the rate limiter itself fails", async () => {
    const d = { ...deps(), limiter: vi.fn(async () => { throw new Error("db down"); }) };
    const result = await runGuestBrief(ok, d);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ code: "unavailable" });
  });

  it("answers {code: unavailable} before its deadline when research runs long", async () => {
    const slow = { ...deps(), deadlineMs: 50, search: vi.fn(() => new Promise<never>(() => {})) };
    const started = Date.now();
    const result = await runGuestBrief(ok, slow);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ code: "unavailable" });
  });

  it("episode_questions returns exactly 8 questions", async () => {
    const result = await runEpisodeQuestions(ok, deps());
    expect(JSON.parse(result.content[0].text).questions).toHaveLength(8);
  });
});
