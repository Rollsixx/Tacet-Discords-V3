import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { mkdir, copyFile, readdir, unlink } from "node:fs/promises";
const require = createRequire(import.meta.url);
const output = "public/ocr";
await mkdir(join(output, "core"), { recursive: true });
await mkdir(join(output, "lang"), { recursive: true });
await copyFile(join(dirname(require.resolve("tesseract.js/package.json")), "dist/worker.min.js"), join(output, "worker.min.js"));
await copyFile(join(dirname(require.resolve("tesseract.js/package.json")), "LICENSE.md"), join(output, "TESSERACT_LICENSE.txt"));
const core = dirname(require.resolve("tesseract.js-core/package.json"));
const browserCores=["tesseract-core-lstm.wasm.js","tesseract-core-simd-lstm.wasm.js","tesseract-core-relaxedsimd-lstm.wasm.js","LICENSE"];
// Clear previously generated variants from an incremental build cache.
for(const name of await readdir(join(output,"core")))if(!browserCores.includes(name))await unlink(join(output,"core",name));
for(const name of browserCores)await copyFile(join(core,name),join(output,"core",name));
const language = require("@tesseract.js-data/eng");
await copyFile(join(language.langPath, "eng.traineddata.gz"), join(output, "lang/eng.traineddata.gz"));
console.log("Local OCR worker, core and English language assets prepared.");
