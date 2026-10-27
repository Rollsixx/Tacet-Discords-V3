// Run only against an isolated local database; inserts synthetic test records.
import assert from "node:assert/strict";
import { fixture } from "../src/lib/server/fixtures.mjs";
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("Smoke tests require localhost.");
const token = process.env.MODERATOR_TOKEN;
if (!token) throw new Error("MODERATOR_TOKEN required.");
const auth = { Authorization: "Bearer " + token };
async function post(path, body, authorized = false) {
  return fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(authorized ? auth : {}) }, body: JSON.stringify(body) });
}
for (const path of ["/", "/import", "/profiles", "/leaderboards"]) {
  assert.equal((await fetch(base + path)).status, 200);
}
const firstInput = fixture(String(800000000 + Math.floor(Math.random() * 99999999)));
firstInput.slots[0].substats[0].raw = "Crit. Rate 105%";
const response = await post("/api/submissions", firstInput);
assert.equal(response.status, 201, await response.clone().text());
const saved = await response.json();
assert.equal(saved.status, "pending");
const asset = "/api/assets/" + saved.id + "-1-portrait";
assert.equal((await fetch(base + asset)).status, 401);
assert.equal((await fetch(base + asset, { headers: auth })).status, 200);
const publicUrl = base + "/api/public/builds?search=" + firstInput.uid;
assert.equal((await (await fetch(publicUrl)).json()).builds.length, 0);
assert.equal((await post("/api/submissions", firstInput)).status, 409);
const review = { id: saved.id, action: "approved", reviewer: "HTTP test", note: "Synthetic fixture", identityVerified: false };
assert.equal((await post("/api/moderation", review)).status, 401);
assert.equal((await post("/api/moderation", review, true)).status, 200);
assert.equal((await post("/api/moderation", review, true)).status, 409);
assert.equal((await fetch(base + asset)).status, 200);
const publicResult = await (await fetch(publicUrl)).json();
assert.equal(publicResult.builds[0].id, saved.id);
assert.equal(publicResult.builds[0].data.slots[0].substats[0].raw, "Crit. Rate 105%");
assert.equal(publicResult.builds[0].score, null);
assert.equal(publicResult.scoring.enabled, true);
const secondInput = fixture(String(Number(firstInput.uid) + 1));
const rejected = await (await post("/api/submissions", secondInput)).json();
assert.equal((await post("/api/moderation", { ...review, id: rejected.id, action: "rejected" }, true)).status, 200);
assert.equal((await (await fetch(base + "/api/public/builds?search=" + secondInput.uid)).json()).builds.length, 0);
assert.equal((await fetch(base + "/api/assets/" + rejected.id + "-1-sonata")).status, 401);
console.log("HTTP smoke PASS: four pages, pending persistence, private crops, duplicate protection, unauthorized review, approval, rejection, public approved lookup, unscored gate.");
