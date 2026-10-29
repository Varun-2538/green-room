import { describe, expect, it, vi } from "vitest";
import { TinyFishError, tinyfishFetch, tinyfishSearch } from "@/lib/tinyfish";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("tinyfishSearch", () => {
  it("sends a GET with the query and API key and parses results", async () => {
    const fetch = vi.fn(async () =>
      json({
        query: "a b",
        results: [
          { position: 1, title: "T", url: "https://x.com/arun", snippet: "S", site_name: "x.com" },
          { position: 2, title: "missing url" },
        ],
      }),
    );
    const results = await tinyfishSearch("a b", { fetch, apiKey: "k1" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.search.tinyfish.ai/?query=a+b");
    expect(new Headers(init.headers).get("X-API-Key")).toBe("k1");
    expect(results).toEqual([{ position: 1, title: "T", url: "https://x.com/arun", snippet: "S", site_name: "x.com" }]);
  });

  it("passes purpose when given", async () => {
    const fetch = vi.fn(async () => json({ results: [] }));
    await tinyfishSearch("q", { fetch, apiKey: "k", purpose: "research a guest" });
    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(new URL(url).searchParams.get("purpose")).toBe("research a guest");
  });

  it("throws TinyFishError with the status on a non-200", async () => {
    const fetch = vi.fn(async () => json({ error: "nope" }, 401));
    await expect(tinyfishSearch("q", { fetch, apiKey: "k" })).rejects.toMatchObject({
      name: "TinyFishError",
      status: 401,
    });
    await expect(tinyfishSearch("q", { fetch, apiKey: "k" })).rejects.toBeInstanceOf(TinyFishError);
  });
});

describe("tinyfishFetch", () => {
  it("posts urls as markdown and splits pages from failures", async () => {
    const fetch = vi.fn(async () =>
      json({
        results: [{ url: "https://a.com", final_url: "https://a.com/", title: "A", text: "hello" }],
        errors: [{ url: "https://b.com", error: "timeout" }],
      }),
    );
    const out = await tinyfishFetch(["https://a.com", "https://b.com"], { fetch, apiKey: "k" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.fetch.tinyfish.ai");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ urls: ["https://a.com", "https://b.com"], format: "markdown" });
    expect(out).toEqual({
      pages: [{ url: "https://a.com", finalUrl: "https://a.com/", title: "A", text: "hello" }],
      failed: [{ url: "https://b.com", error: "timeout" }],
    });
  });

  it("sends at most 10 unique urls", async () => {
    const fetch = vi.fn(async () => json({ results: [], errors: [] }));
    const urls = ["https://dup.com", "https://dup.com", ...Array.from({ length: 12 }, (_, i) => `https://s${i}.com`)];
    await tinyfishFetch(urls, { fetch, apiKey: "k" });
    const sent = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)).urls;
    expect(sent).toHaveLength(10);
    expect(sent[0]).toBe("https://dup.com");
    expect(sent[1]).toBe("https://s0.com");
  });

  it("makes no request for an empty url list", async () => {
    const fetch = vi.fn();
    expect(await tinyfishFetch([], { fetch, apiKey: "k" })).toEqual({ pages: [], failed: [] });
    expect(fetch).not.toHaveBeenCalled();
  });
});
