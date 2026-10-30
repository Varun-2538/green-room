import { describe, expect, it } from "vitest";
import { agentDeepLink, buildAgentPrompt, parseHandoff } from "@/lib/handoff";

const EP = "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b";
const sp = (q: string) => new URLSearchParams(q);

describe("parseHandoff", () => {
  it("accepts a well-formed link from the agent", () => {
    const result = parseHandoff(
      sp(
        `n=Arun&x=https%3A%2F%2Fx.com%2Farun&web=https%3A%2F%2Farun.blog&lm=founders+on+a+10-year+horizon&t=quitting+safe+paths&ep=${EP}`,
      ),
    );
    expect(result).toEqual({
      ok: true,
      guest: {
        name: "Arun",
        links: ["https://x.com/arun", "https://arun.blog"],
        lookingToMeet: "founders on a 10-year horizon",
      },
      topic: "quitting safe paths",
      episodeId: EP,
      warnings: [],
    });
  });

  it("drops params that are not on the allow-list, so Mosaic text can never be stored", () => {
    const result = parseHandoff(sp("n=Arun&why=you+both+love+jazz&overlaps=secret&them=private+answer"));
    expect(JSON.stringify(result)).not.toMatch(/jazz|secret|private answer/);
  });

  it.each([
    ["javascript:alert(1)"],
    ["http://insecure.example"],
    ["https://" + "a".repeat(500) + ".com"],
    ["not a url"],
  ])("drops the unsafe link %s and warns", (bad) => {
    const result = parseHandoff(sp(`n=Arun&web=${encodeURIComponent(bad)}&gh=https%3A%2F%2Fgithub.com%2Farun`));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.guest.links).toEqual(["https://github.com/arun"]);
    expect(result.warnings).toHaveLength(1);
  });

  it("de-duplicates links", () => {
    const result = parseHandoff(sp("n=Arun&x=https%3A%2F%2Fx.com%2Farun&web=https%3A%2F%2Fx.com%2Farun"));
    expect(result.ok && result.guest.links).toEqual(["https://x.com/arun"]);
  });

  it("requires a name", () => {
    expect(parseHandoff(sp("x=https%3A%2F%2Fx.com%2Farun"))).toMatchObject({ ok: false });
    expect(parseHandoff(sp("n=%20%20"))).toMatchObject({ ok: false });
  });

  it("rejects a name over 120 characters", () => {
    expect(parseHandoff(sp(`n=${"a".repeat(121)}`))).toMatchObject({ ok: false });
  });

  it("truncates looking-to-meet text at 300 characters", () => {
    const result = parseHandoff(sp(`n=Arun&lm=${"b".repeat(400)}`));
    expect(result.ok && result.guest.lookingToMeet).toBe("b".repeat(300));
  });

  it("ignores an episode id that is not a UUID", () => {
    const result = parseHandoff(sp("n=Arun&ep=../../etc"));
    expect(result.ok && result.episodeId).toBeUndefined();
  });
});

describe("buildAgentPrompt", () => {
  const prompt = buildAgentPrompt({
    showName: "In Between",
    topic: "people who quit a safe path",
    appUrl: "https://green-room.test",
    episodeId: EP,
  });

  it("names the show and topic", () => {
    expect(prompt).toContain("In Between");
    expect(prompt).toContain("people who quit a safe path");
  });

  it("gives the agent the exact link format for this episode", () => {
    expect(prompt).toContain("https://green-room.test/add?");
    expect(prompt).toContain(`ep=${EP}`);
  });

  it("tells the agent to keep Mosaic page content out of the link", () => {
    expect(prompt).toContain("Put only public Rolodex info in the link, never anything from our Mosaic page.");
  });

  it("produces a link format that parseHandoff accepts", () => {
    const template = prompt.match(/https:\/\/green-room\.test\/add\?\S+/)?.[0] ?? "";
    const filled = template
      .replace("<name>", "Arun")
      .replace("<x_url>", encodeURIComponent("https://x.com/arun"))
      .replace("<github_url>", "")
      .replace("<other_url>", "")
      .replace("<looking_to_meet>", "storytellers")
      .replace("<topic>", "quitting");
    const parsed = parseHandoff(new URL(filled).searchParams);
    expect(parsed).toMatchObject({ ok: true, episodeId: EP, guest: { name: "Arun", links: ["https://x.com/arun"] } });
  });
});

describe("agentDeepLink", () => {
  it("opens a DM with the agent and the text pre-filled", () => {
    expect(agentDeepLink("@edge_city_agent_qbdffu_bot", "hi there")).toBe(
      "https://t.me/edge_city_agent_qbdffu_bot?text=hi%20there",
    );
  });
});

describe("Telegram in the handoff", () => {
  it("turns a Telegram username into a t.me link, first in the list", () => {
    const result = parseHandoff(sp("n=Arun&x=https%3A%2F%2Fx.com%2Farun&tg=%40arun_p"));
    expect(result.ok && result.guest.links).toEqual(["https://t.me/arun_p", "https://x.com/arun"]);
  });

  it("accepts a t.me link too, and skips a username that isn't one", () => {
    expect(parseHandoff(sp("n=Arun&tg=https%3A%2F%2Ft.me%2Farun_p"))).toMatchObject({ ok: true, guest: { links: ["https://t.me/arun_p"] } });
    const bad = parseHandoff(sp("n=Arun&tg=not%20a%20name"));
    expect(bad).toMatchObject({ ok: true, guest: { links: [] } });
    expect(bad.ok && bad.warnings.join(" ")).toMatch(/Telegram/);
  });

  it("asks the agent for the guest's Telegram username", () => {
    expect(buildAgentPrompt({ showName: "S", topic: "T", appUrl: "https://x.test", episodeId: EP })).toContain("tg=<telegram_username>");
  });
});

describe("Telegram from the Rolodex", () => {
  it("tells the agent to copy the guest's Telegram from their Rolodex profile", () => {
    expect(buildAgentPrompt({ showName: "S", topic: "T", appUrl: "https://x.test", episodeId: EP })).toMatch(/Telegram username from their Rolodex profile/);
  });

  it("asks the agent to look up an existing guest's Telegram and reply with a link back to their page", async () => {
    const { telegramLookupPrompt } = await import("@/lib/handoff");
    const prompt = telegramLookupPrompt({ guestName: "Yudhishthra Sugumaran", appUrl: "https://x.test", guestId: EP });
    expect(prompt).toContain("Yudhishthra Sugumaran");
    expect(prompt).toContain("Rolodex");
    expect(prompt).toContain(`https://x.test/guest/${EP}?tg=<telegram_username>`);
  });
});
