// Prints the SHA-256 Edge City pins in manifest.json (skills[0].sha256), and updates it in place.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const dir = "mini-app/green-room";
const sha = createHash("sha256").update(readFileSync(`${dir}/SKILL.md`)).digest("hex");
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
manifest.skills[0].sha256 = sha;
writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(sha);
