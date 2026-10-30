import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const skillBytes = readFileSync("mini-app/green-room/SKILL.md");
const manifestText = readFileSync("mini-app/green-room/manifest.json", "utf8");
const manifest = JSON.parse(manifestText);

describe("green-room SKILL.md (Edge City mini-app rules)", () => {
  it("is at most 32 KiB of UTF-8 with no BOM", () => {
    expect(skillBytes.length).toBeLessThanOrEqual(32768);
    expect(skillBytes[0]).not.toBe(0xef);
    expect(() => new TextDecoder("utf-8", { fatal: true }).decode(skillBytes)).not.toThrow();
  });

  it("has plain ASCII key: value frontmatter naming itself green-room", () => {
    const text = skillBytes.toString("utf8");
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    expect(match).not.toBeNull();
    const lines = match![1].split("\n");
    for (const line of lines) expect(line).toMatch(/^[a-z_]+: [\x20-\x7e]+$/);
    expect(lines.filter((l) => l.startsWith("name:"))).toEqual(["name: green-room"]);
  });
});

describe("green-room manifest.json", () => {
  it("is canonical JSON", () => {
    expect(manifestText).toBe(JSON.stringify(manifest, null, 2) + "\n");
  });

  it("is a generic public read relay", () => {
    expect(manifest).toMatchObject({
      manifest: 2,
      id: "green-room",
      version: "1.0.0",
      visibility: "sandbox",
      service: { kind: "mcp", auth: { mode: "none" } },
    });
    expect(manifest.service.baseUrl).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/[a-z/]*$/);
    expect(manifest.operations.length).toBeGreaterThan(0);
    for (const op of manifest.operations) {
      expect(op.class).toBe("read");
      expect(op.name).toMatch(/^green-room\.[a-z-]+$/);
      expect(typeof op.target.tool).toBe("string");
    }
  });

  it("pins the exact SKILL.md bytes", () => {
    expect(manifest.skills[0]).toMatchObject({ name: "green-room", version: "1.0.0", path: "skills/green-room/SKILL.md" });
    expect(manifest.skills[0].sha256).toBe(createHash("sha256").update(skillBytes).digest("hex"));
  });
});
