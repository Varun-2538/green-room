import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it.each([
    ["/add?n=Arun", "/add?n=Arun"],
    ["/guest/123", "/guest/123"],
  ])("keeps the local path %s", (input, want) => {
    expect(safeNextPath(input, "/desk")).toBe(want);
  });

  it.each([
    ["https://evil.example/"],
    ["//evil.example/"],
    ["/\\evil.example"],
    ["javascript:alert(1)"],
    [""],
    [null],
  ])("falls back for unsafe value %s", (input) => {
    expect(safeNextPath(input, "/desk")).toBe("/desk");
  });
});

describe("postLoginDestination", () => {
  it("sends a verified creator where they were going", async () => {
    const { postLoginDestination } = await import("@/lib/auth/redirect");
    expect(postLoginDestination("/desk", true)).toBe("/desk");
  });

  it("sends an unverified creator to World ID first", async () => {
    const { postLoginDestination } = await import("@/lib/auth/redirect");
    expect(postLoginDestination("/add?n=Arun", false)).toBe("/verify?next=%2Fadd%3Fn%3DArun");
  });

  it("sends a guest straight back to their invite card, without World ID", async () => {
    const { postLoginDestination } = await import("@/lib/auth/redirect");
    expect(postLoginDestination("/i/abcDEF123_-x", false)).toBe("/i/abcDEF123_-x");
  });
});
