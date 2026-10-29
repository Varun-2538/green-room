import { describe, expect, it } from "vitest";
import { loadEnv } from "@/lib/env";

const valid = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  SESSION_SECRET: "x".repeat(32),
  TELEGRAM_LOGIN_BOT_TOKEN: "123:abc",
  NEXT_PUBLIC_TELEGRAM_LOGIN_BOT: "green_room_login_bot",
  NEXT_PUBLIC_WORLD_APP_ID: "app_test",
  NEXT_PUBLIC_WORLD_RP_ID: "rp_test",
  RP_SIGNING_KEY: "deadbeef",
  TINYFISH_API_KEY: "tf_test",
  XAI_API_KEY: "xai_test",
  NEXT_PUBLIC_APP_URL: "https://green-room.example",
};

describe("loadEnv", () => {
  it("defaults XAI_MODEL to grok-4.7 when unset", () => {
    expect(loadEnv(valid).XAI_MODEL).toBe("grok-4.7");
  });

  it("keeps an explicit XAI_MODEL", () => {
    expect(loadEnv({ ...valid, XAI_MODEL: "grok-4.6" }).XAI_MODEL).toBe("grok-4.6");
  });

  it("rejects a SESSION_SECRET shorter than 32 characters, naming the key", () => {
    expect(() => loadEnv({ ...valid, SESSION_SECRET: "short12345" })).toThrow(/SESSION_SECRET/);
  });

  it("rejects a missing DATABASE_URL, naming the key", () => {
    const rest: Record<string, string> = { ...valid };
    delete rest.DATABASE_URL;
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/);
  });
});
