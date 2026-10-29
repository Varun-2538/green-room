import { describe, expect, it } from "vitest";
import { isLinkPreviewBot } from "@/lib/bots";

describe("isLinkPreviewBot", () => {
  it.each([
    ["TelegramBot (like TwitterBot)"],
    ["facebookexternalhit/1.1"],
    ["WhatsApp/2.23.20.0"],
    ["Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"],
    ["Slackbot-LinkExpanding 1.0"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1)"],
    [""],
  ])("treats %s as a preview bot", (ua) => {
    expect(isLinkPreviewBot(ua)).toBe(true);
  });

  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"],
    ["Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36 Telegram-Android/11.0"],
  ])("treats %s as a person", (ua) => {
    expect(isLinkPreviewBot(ua)).toBe(false);
  });
});
