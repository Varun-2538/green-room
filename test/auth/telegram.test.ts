import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTelegramAuth } from "@/lib/auth/telegram";

const BOT_TOKEN = "123456:TEST_BOT_TOKEN";
const NOW = new Date("2026-10-30T06:00:00Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);

/** Signs login params exactly as Telegram documents it. */
function sign(fields: Record<string, string>, token = BOT_TOKEN): Record<string, string> {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return { ...fields, hash };
}

const fields = {
  id: "42",
  first_name: "Varun",
  username: "varun",
  photo_url: "https://t.me/i/userpic/320/varun.jpg",
  auth_date: String(NOW_SEC - 60),
};

describe("verifyTelegramAuth", () => {
  it("accepts correctly signed login params and parses the user", () => {
    expect(verifyTelegramAuth(sign(fields), BOT_TOKEN, NOW)).toEqual({
      id: 42,
      first_name: "Varun",
      username: "varun",
      photo_url: "https://t.me/i/userpic/320/varun.jpg",
      auth_date: NOW_SEC - 60,
    });
  });

  it("rejects params where a field changed after signing", () => {
    expect(verifyTelegramAuth({ ...sign(fields), id: "43" }, BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects params signed with a different bot token", () => {
    expect(verifyTelegramAuth(sign(fields, "999:OTHER"), BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects a login older than 24 hours", () => {
    const old = sign({ ...fields, auth_date: String(NOW_SEC - 86_401) });
    expect(verifyTelegramAuth(old, BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects params with no hash", () => {
    expect(verifyTelegramAuth(fields, BOT_TOKEN, NOW)).toBeNull();
  });
});
