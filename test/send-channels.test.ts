import { describe, expect, it } from "vitest";
import { inviteText, sendChannels, telegramLink } from "@/lib/send-channels";

const text = "Hi Arun, would you come on In Between?\n\nhttps://green-room.test/i/abcDEF123_-x";

describe("telegramLink", () => {
  it("reads a username from a t.me link or a bare handle", () => {
    expect(telegramLink("https://t.me/arun_p")).toBe("arun_p");
    expect(telegramLink("@arun_p")).toBe("arun_p");
    expect(telegramLink("arun_p")).toBe("arun_p");
    expect(telegramLink("https://t.me/+invitehash")).toBeNull();
    expect(telegramLink("ab")).toBeNull();
    expect(telegramLink("https://x.com/arun")).toBeNull();
  });
});

describe("sendChannels", () => {
  it("puts Telegram first, with the message pre-typed", () => {
    const [first, ...rest] = sendChannels(["https://x.com/arun", "https://t.me/arun_p"], text);
    expect(first).toEqual({ platform: "telegram", label: "Telegram", href: `https://t.me/arun_p?text=${encodeURIComponent(text)}`, prefilled: true });
    expect(rest.map((c) => c.platform)).toEqual(["x"]);
  });

  it("falls back to the guest's other platforms, in a useful order", () => {
    const channels = sendChannels(
      ["https://arun.blog", "https://github.com/arun", "https://www.linkedin.com/in/arun", "https://x.com/arun", "https://instagram.com/arun"],
      text,
    );
    expect(channels.map((c) => c.platform)).toEqual(["x", "linkedin", "instagram", "web", "github"]);
    expect(channels.find((c) => c.platform === "x")).toMatchObject({ label: "X", href: "https://x.com/arun", prefilled: false });
  });

  it("recognises twitter.com, and offers nothing when there are no links", () => {
    expect(sendChannels(["https://twitter.com/arun"], text)[0].platform).toBe("x");
    expect(sendChannels([], text)).toEqual([]);
  });
});

describe("inviteText", () => {
  it("puts the card link after the message", () => {
    expect(inviteText("Hi Arun", "https://green-room.test/i/abc")).toBe("Hi Arun\n\nhttps://green-room.test/i/abc");
  });
});
