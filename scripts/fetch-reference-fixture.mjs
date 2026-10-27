// Development test input only. Never ship the screenshot as a website asset.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const commit = "b32cdbd3e3c6c3a838e6e5abb71fe46c79c876c5";
const url = `https://raw.githubusercontent.com/ryanbenson/wuthering-waves-optimizer/${commit}/tests/fixtures/buildCards/hsin_temp_from_bot_4_of_5.jpeg`;
const response = await fetch(url);
if (!response.ok) throw new Error("Reference fixture download failed: " + response.status);
const bytes = Buffer.from(await response.arrayBuffer());
if (createHash("sha256").update(bytes).digest("hex") !== "f3ffd70c5660bfb4edd26f420d62d360c018d8fe7a9c3681e06cabd8355bf797") throw new Error("Reference fixture integrity mismatch.");
await mkdir(".cache", { recursive: true });
await writeFile(".cache/reference-four-slot.jpeg", bytes);
console.log("Pinned four-slot reference fixture downloaded for local verification only.");
