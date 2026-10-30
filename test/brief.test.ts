import { describe, expect, it, vi } from "vitest";
import { buildBrief, getLatestBrief, saveBrief } from "@/lib/brief";
import { creators } from "@/lib/db/schema";
import { createEpisode } from "@/lib/episodes";
import { addGuest } from "@/lib/guests";
import type { tinyfishFetch, tinyfishSearch } from "@/lib/tinyfish";
import { mockJsonModel } from "./helpers/ai";
import { makeTestDb } from "./helpers/db";

const input = {
  name: "Yudhishthra Sugumaran",
  links: ["https://github.com/0xYudhishthra", "https://x.com/0xYudhishthra"],
  topic: "people who quit a safe path",
  showName: "In Between",
  lookingToMeet: "long-term thinkers on a 10-year horizon",
};

const searchResults = [
  { position: 1, title: "LinkedIn", url: "https://linkedin.com/in/yudhishthra", snippet: "Co-Founder & CTO of Aqua0" },
  { position: 2, title: "EIP Hub", url: "https://eiphub.example/talk", snippet: "Why your local-currency stablecoin has no liquidity" },
  { position: 3, title: "GitHub", url: "https://github.com/0xYudhishthra", snippet: "DeFi" },
  { position: 4, title: "Fourth", url: "https://fourth.example", snippet: "not fetched" },
];

const pages = [
  { url: "https://github.com/0xYudhishthra", finalUrl: "https://github.com/0xYudhishthra", text: "prev Nethermind · Etherscan. Building Aqua0." },
  { url: "https://x.com/0xYudhishthra", finalUrl: "https://x.com/0xYudhishthra", text: "our colosseum submission is in" },
];

const modelAnswer = {
  story: "Went from student club lead to CTO of Aqua0.",
  recentWork: [
    { title: "EIP Hub talk", url: "https://eiphub.example/talk", date: null },
    { title: "Made up", url: "https://invented.example", date: null },
  ],
  questions: Array.from({ length: 10 }, (_, i) => `Question ${i + 1}?`),
  facts: [
    { text: "Worked at Nethermind", sourceUrl: "https://github.com/0xYudhishthra" },
    { text: "Won a Nobel prize", sourceUrl: "https://invented.example" },
  ],
};

function deps(over: Partial<{ search: typeof tinyfishSearch; fetchPages: typeof tinyfishFetch }> = {}) {
  const ai = mockJsonModel(modelAnswer);
  const search = vi.fn<typeof tinyfishSearch>(async () => searchResults);
  const fetchPages = vi.fn<typeof tinyfishFetch>(async () => ({ pages, failed: [] }));
  return { ai, search, fetchPages, deps: { search, fetchPages, model: ai.model, ...over } };
}

describe("buildBrief", () => {
  it("searches by quoted name plus the handle from their first link", async () => {
    const { search, deps: d } = deps();
    await buildBrief(input, d);
    expect(search.mock.calls[0][0]).toBe('"Yudhishthra Sugumaran" 0xYudhishthra');
  });

  it("fetches the given links plus the top 3 search results, without duplicates", async () => {
    const { fetchPages, deps: d } = deps();
    await buildBrief(input, d);
    expect(fetchPages.mock.calls[0][0]).toEqual([
      "https://github.com/0xYudhishthra",
      "https://x.com/0xYudhishthra",
      "https://linkedin.com/in/yudhishthra",
      "https://eiphub.example/talk",
    ]);
  });

  it("drops facts and recent work whose source was never fetched or found", async () => {
    const { deps: d } = deps();
    const brief = await buildBrief(input, d);
    expect(brief.facts).toEqual([{ text: "Worked at Nethermind", sourceUrl: "https://github.com/0xYudhishthra" }]);
    expect(brief.recentWork).toEqual([{ title: "EIP Hub talk", url: "https://eiphub.example/talk" }]);
  });

  it("returns exactly 8 questions when the model gives more", async () => {
    const { deps: d } = deps();
    expect((await buildBrief(input, d)).questions).toHaveLength(8);
  });

  it("pads to 8 questions when the model gives fewer", async () => {
    const ai = mockJsonModel({ ...modelAnswer, questions: ["Only one?"] });
    const { deps: d } = deps();
    const brief = await buildBrief(input, { ...d, model: ai.model });
    expect(brief.questions).toHaveLength(8);
    expect(brief.questions[0]).toBe("Only one?");
  });

  it("gives the model the page text and the public looking-to-meet line", async () => {
    const { ai, deps: d } = deps();
    await buildBrief(input, d);
    const prompt = ai.prompts()[0];
    expect(prompt).toContain("prev Nethermind");
    expect(prompt).toContain("long-term thinkers on a 10-year horizon");
  });

  it("never sends fields beyond the public guest facts to the model", async () => {
    const { ai, deps: d } = deps();
    const leaky = { ...input, creatorNote: "SECRET NOTE", why: "MOSAIC OVERLAP" } as typeof input;
    await buildBrief(leaky, d);
    expect(ai.prompts()[0]).not.toMatch(/SECRET NOTE|MOSAIC OVERLAP/);
  });

  it("is honest when there is no public information at all", async () => {
    const ai = mockJsonModel(modelAnswer);
    const brief = await buildBrief(
      { ...input, links: [] },
      {
        search: vi.fn(async () => []),
        fetchPages: vi.fn(async () => ({ pages: [], failed: [] })),
        model: ai.model,
      },
    );
    expect(brief.limited).toBe(true);
    expect(brief.facts).toEqual([]);
    expect(brief.story).toContain("limited public information");
    expect(brief.questions).toHaveLength(8);
    expect(ai.prompts()).toHaveLength(0);
  });

  it("falls back to an honest brief when TinyFish search and fetch both throw", async () => {
    const ai = mockJsonModel(modelAnswer);
    const brief = await buildBrief(input, {
      search: vi.fn(async () => { throw new Error("TinyFish 402"); }),
      fetchPages: vi.fn(async () => { throw new Error("timeout"); }),
      model: ai.model,
    });
    expect(brief.limited).toBe(true);
    expect(brief.facts).toEqual([]);
    expect(brief.story).toContain("limited public information");
  });

  it("still builds a brief from fetched pages when only search throws", async () => {
    const { deps: d } = deps({ search: vi.fn(async () => { throw new Error("TinyFish 500"); }) });
    const brief = await buildBrief(input, d);
    expect(brief.facts).toEqual([{ text: "Worked at Nethermind", sourceUrl: "https://github.com/0xYudhishthra" }]);
  });

  it("still builds a brief when every fetch fails but search found something", async () => {
    const { deps: d } = deps({ fetchPages: vi.fn(async () => ({ pages: [], failed: [{ url: "x", error: "timeout" }] })) });
    const brief = await buildBrief(input, d);
    expect(brief.limited).toBe(true);
    expect(brief.facts.every((f) => searchResults.some((r) => r.url === f.sourceUrl))).toBe(true);
  });
});

describe("saveBrief / getLatestBrief", () => {
  it("returns the newest saved brief for the guest", async () => {
    const db = await makeTestDb();
    const [c] = await db.insert(creators).values({ telegramId: 1, name: "V" }).returning();
    const ep = await createEpisode(db, c.id, "Topic here");
    const g = await addGuest(db, c.id, ep.id, { name: "A", links: [] });
    const base = { story: "s", recentWork: [], questions: [], facts: [], limited: false, sources: [] };
    await saveBrief(db, g.id, { ...base, story: "first" });
    await saveBrief(db, g.id, { ...base, story: "second" });
    expect((await getLatestBrief(db, g.id))?.story).toBe("second");
  });

  it("returns null when there is no brief", async () => {
    const db = await makeTestDb();
    expect(await getLatestBrief(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("schemas sent to the model (Groq strict structured output)", () => {
  /** Groq rejects a JSON schema unless every object lists all of its properties in `required`. */
  function optionalKeys(schema: unknown, path = "$"): string[] {
    if (!schema || typeof schema !== "object") return [];
    const s = schema as { type?: unknown; properties?: Record<string, unknown>; required?: string[]; items?: unknown };
    const out: string[] = [];
    if (s.properties) {
      for (const key of Object.keys(s.properties)) {
        if (!(s.required ?? []).includes(key)) out.push(`${path}.${key}`);
        out.push(...optionalKeys(s.properties[key], `${path}.${key}`));
      }
    }
    if (s.items) out.push(...optionalKeys(s.items, `${path}[]`));
    return out;
  }

  it("brief: every field is required (nullable instead of optional)", async () => {
    const ai = mockJsonModel(modelAnswer);
    await buildBrief(input, { search: vi.fn(async () => searchResults), fetchPages: vi.fn(async () => ({ pages, failed: [] })), model: ai.model });
    const format = ai.model.doGenerateCalls[0].responseFormat as { schema?: unknown };
    expect(optionalKeys(format.schema)).toEqual([]);
  });

  it("brief: a null date from the model is dropped, not shown", async () => {
    const answer = { ...modelAnswer, recentWork: [{ title: "EIP Hub talk", url: "https://eiphub.example/talk", date: null }] };
    const ai = mockJsonModel(answer);
    const brief = await buildBrief(input, { search: vi.fn(async () => searchResults), fetchPages: vi.fn(async () => ({ pages, failed: [] })), model: ai.model });
    expect(brief.recentWork).toEqual([{ title: "EIP Hub talk", url: "https://eiphub.example/talk" }]);
  });
});
