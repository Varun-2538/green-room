// Prints the SHA-256 Edge City pins in manifest.json (skills[0].sha256), and updates it in place.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const manifestPath = "mini-apps/green-room/manifest.json";
const sha = createHash("sha256").update(readFileSync("skills/green-room/SKILL.md")).digest("hex");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.skills[0].sha256 = sha;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(sha);
