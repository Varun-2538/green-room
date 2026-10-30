import { z } from "zod";
import { env } from "@/lib/env";

const SEARCH_URL = "https://api.search.tinyfish.ai";
const FETCH_URL = "https://api.fetch.tinyfish.ai";
const MAX_FETCH_URLS = 10;
const PER_URL_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 25_000;

export class TinyFishError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TinyFishError";
  }
}

const searchResult = z.object({
  position: z.number(),
  title: z.string(),
  url: z.url(),
  snippet: z.string().default(""),
  site_name: z.string().optional(),
  date: z.string().optional(),
});
export type SearchResult = z.infer<typeof searchResult>;

const fetchedPage = z.object({
  url: z.string(),
  final_url: z.string().optional(),
  title: z.string().nullish(),
  text: z.string(),
});
export type FetchedPage = { url: string; finalUrl: string; title?: string; text: string };

type Options = {
  purpose?: string;
  fetch?: typeof fetch;
  apiKey?: string;
  /** Whole-request budget; callers with a hard deadline (the MCP path) pass a shorter one. */
  timeoutMs?: number;
  /** Per-URL render budget for fetch. */
  perUrlTimeoutMs?: number;
};

async function call(url: string, init: RequestInit, o: Options): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", o.apiKey ?? env.TINYFISH_API_KEY);
  const response = await (o.fetch ?? fetch)(url, { ...init, headers, signal: AbortSignal.timeout(o.timeoutMs ?? REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new TinyFishError(`TinyFish answered ${response.status}`, response.status);
  return response.json();
}

/** Ranked web results. Malformed items are dropped rather than failing the whole search. */
export async function tinyfishSearch(query: string, o: Options = {}): Promise<SearchResult[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("query", query);
  if (o.purpose) url.searchParams.set("purpose", o.purpose);
  const body = (await call(url.toString(), { method: "GET" }, o)) as { results?: unknown[] };
  return (body.results ?? []).flatMap((item) => {
    const parsed = searchResult.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Clean page text for up to 10 URLs. Per-URL failures come back in `failed`, not as an error. */
export async function tinyfishFetch(
  urls: string[],
  o: Options = {},
): Promise<{ pages: FetchedPage[]; failed: { url: string; error: string }[] }> {
  const unique = [...new Set(urls)].slice(0, MAX_FETCH_URLS);
  if (unique.length === 0) return { pages: [], failed: [] };

  const body = (await call(
    FETCH_URL,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        urls: unique,
        format: "markdown",
        per_url_timeout_ms: o.perUrlTimeoutMs ?? PER_URL_TIMEOUT_MS,
        ...(o.purpose ? { purpose: o.purpose } : {}),
      }),
    },
    o,
  )) as { results?: unknown[]; errors?: { url?: string; error?: string }[] };

  const pages = (body.results ?? []).flatMap((item) => {
    const parsed = fetchedPage.safeParse(item);
    if (!parsed.success) return [];
    const { url, final_url, title, text } = parsed.data;
    return [{ url, finalUrl: final_url ?? url, ...(title ? { title } : {}), text }];
  });
  const failed = (body.errors ?? []).map((e) => ({ url: String(e.url ?? ""), error: String(e.error ?? "unknown") }));
  return { pages, failed };
}
