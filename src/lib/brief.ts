import { generateText, type LanguageModel, Output } from "ai";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { lowReasoning } from "@/lib/ai/model";
import type { Db } from "@/lib/db/client";
import { briefs, type RecentWork, type SourcedFact } from "@/lib/db/schema";
import type { tinyfishFetch, tinyfishSearch } from "@/lib/tinyfish";

export type Brief = {
  story: string;
  recentWork: RecentWork[];
  questions: string[];
  facts: SourcedFact[];
  limited: boolean;
  sources: string[];
};

export type BriefInput = { name: string; links: string[]; topic: string; showName: string; lookingToMeet?: string };

export type BriefDeps = { search: typeof tinyfishSearch; fetchPages: typeof tinyfishFetch; model: LanguageModel };

const QUESTION_COUNT = 8;
const SEARCH_RESULTS_TO_FETCH = 3;
const PAGE_CHARS = 6000;
const SOCIAL_HOSTS = ["x.com", "twitter.com", "github.com", "youtube.com", "linkedin.com", "instagram.com"];

const FALLBACK_QUESTIONS = [
  "What were you doing right before the work you're known for now?",
  "What was the moment you decided to change direction?",
  "What did that in-between stretch actually feel like, day to day?",
  "Who or what helped you most when it was uncertain?",
  "What did you have to unlearn along the way?",
  "What would you tell someone standing where you stood back then?",
  "What are you still figuring out today?",
  "What's the question you wish people asked you more?",
];

const briefSchema = z.object({
  story: z.string(),
  // Groq strict mode needs every key required, so an unknown date is null rather than absent.
  recentWork: z.array(z.object({ title: z.string(), url: z.string(), date: z.string().nullable() })),
  questions: z.array(z.string()),
  facts: z.array(z.object({ text: z.string(), sourceUrl: z.string() })),
});

const SYSTEM = `You write guest briefs for a podcast host.
Use ONLY the sources provided. Every fact must cite the exact URL of the source it came from, copied from the sources list.
If the sources don't say something, leave it out. Never guess, never invent dates, titles or numbers.
Write in plain, warm English. The story is 3-5 sentences about the person's path so far: where they started, what changed, where they are now.
Write ${QUESTION_COUNT} interview questions about the person's journey: turning points, doubts, what they learned, not just their milestones.`;

/** The handle in their first social link (e.g. x.com/0xYudhishthra) disambiguates common names in search. */
function handleFrom(links: string[]): string | undefined {
  for (const link of links) {
    try {
      const url = new URL(link);
      const host = url.hostname.replace(/^www\./, "");
      if (!SOCIAL_HOSTS.includes(host)) continue;
      const parts = url.pathname.split("/").filter(Boolean);
      const handle = host === "linkedin.com" ? parts[1] : parts[0];
      if (handle) return handle.replace(/^@/, "");
    } catch {
      // not a URL; ignore
    }
  }
  return undefined;
}

function toEightQuestions(questions: string[]): string[] {
  const cleaned = questions.map((q) => q.trim()).filter(Boolean);
  const padding = FALLBACK_QUESTIONS.filter((q) => !cleaned.includes(q));
  return [...cleaned, ...padding].slice(0, QUESTION_COUNT);
}

/** Researches a guest's public work with TinyFish, then has the model summarise it with a source on every fact. */
export async function buildBrief(input: BriefInput, deps: BriefDeps): Promise<Brief> {
  // Copy only the public fields, so nothing else on a guest record can reach the model.
  const { name, links, topic, showName, lookingToMeet } = input;

  const handle = handleFrom(links);
  const query = handle ? `"${name}" ${handle}` : `"${name}"`;
  // A whole-request TinyFish failure (out of credits, 5xx, timeout) degrades to fewer sources, never to no brief.
  const results = await deps
    .search(query, { purpose: `Research ${name}'s public work before inviting them onto a podcast` })
    .catch(() => []);
  const toFetch = [...new Set([...links, ...results.slice(0, SEARCH_RESULTS_TO_FETCH).map((r) => r.url)])];
  const { pages } = await deps
    .fetchPages(toFetch, { purpose: `Learn ${name}'s story and recent work` })
    .catch(() => ({ pages: [], failed: [] }));

  const sources = [...new Set([...pages.flatMap((p) => [p.url, p.finalUrl]), ...results.map((r) => r.url)])];
  const limited = pages.length === 0;

  if (pages.length === 0 && results.length === 0) {
    return {
      story: `There is limited public information about ${name} online. Ask them to tell their own story.`,
      recentWork: [],
      questions: toEightQuestions([]),
      facts: [],
      limited: true,
      sources: [],
    };
  }

  const sourceText = [
    ...pages.map((p) => `SOURCE ${p.finalUrl}\nTITLE ${p.title ?? ""}\n${p.text.slice(0, PAGE_CHARS)}`),
    ...results.map((r) => `SOURCE ${r.url}\nSEARCH SNIPPET ${r.title}: ${r.snippet}`),
  ].join("\n\n---\n\n");

  const { output } = await generateText({
    model: deps.model,
    instructions: SYSTEM,
    output: Output.object({ schema: briefSchema }),
    providerOptions: lowReasoning,
    prompt: [
      `Guest: ${name}`,
      `Show: ${showName}`,
      `Episode topic: ${topic}`,
      lookingToMeet ? `What the guest says they want to meet people for: ${lookingToMeet}` : "",
      `Sources:\n\n${sourceText}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const known = new Set(sources);
  const story = limited ? `${output.story} (Based on search snippets only; limited public information was readable.)` : output.story;
  return {
    story,
    recentWork: output.recentWork
      .filter((w) => known.has(w.url))
      .map(({ title, url, date }) => ({ title, url, ...(date ? { date } : {}) })),
    questions: toEightQuestions(output.questions),
    facts: output.facts.filter((f) => known.has(f.sourceUrl)),
    limited,
    sources,
  };
}

export async function saveBrief(db: Db, guestId: string, b: Brief): Promise<void> {
  await db.insert(briefs).values({ guestId, ...b });
}

export async function getLatestBrief(db: Db, guestId: string): Promise<Brief | null> {
  const [row] = await db
    .select()
    .from(briefs)
    .where(eq(briefs.guestId, guestId))
    .orderBy(desc(briefs.createdAt), desc(briefs.id))
    .limit(1);
  if (!row) return null;
  const { story, recentWork, questions, facts, limited, sources } = row;
  return { story, recentWork, questions, facts, limited, sources };
}
