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
