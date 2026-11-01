import assert from "node:assert/strict";

const base = (process.env.DEPLOYMENT_URL || process.env.BASE_URL || "").replace(/\/$/, "");
if (!base) throw new Error("Set DEPLOYMENT_URL to the successful production deployment URL.");
const parsed = new URL(base);
if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".vercel.app")) {
  throw new Error("Refusing production smoke checks against a non-HTTPS Vercel deployment URL.");
}

async function readJson(path) {
  const response = await fetch(new URL(path, base), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  const body = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  assert.ok(body && typeof body === "object", `${path} did not return JSON`);
  return body;
}

let health;
const expectedRelease = process.env.EXPECTED_RELEASE || "";
const deadline = Date.now() + 20 * 60 * 1000;
while (Date.now() < deadline) {
  try {
    health = await readJson("/api/health");
    if (health.ok && (!expectedRelease || health.release === expectedRelease)) break;
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 15000));
}
assert.ok(health?.ok, "Production health reports that the database or migration is not ready.");
assert.ok(!expectedRelease || health.release === expectedRelease, "Production did not serve the expected commit release.");

let rankedBuild = null;
for (const character of ["Brant", "Mornye", "Carlotta"]) {
  const leaderboard = await readJson(`/api/public/leaderboards?character=${encodeURIComponent(character)}&page=1`);
  assert.ok(Array.isArray(leaderboard.builds), "Leaderboard response is missing its builds array.");
  rankedBuild = leaderboard.builds.find(build => build && build.uid && build.id && Number.isFinite(Number(build.score)));
  if (rankedBuild) break;
}
assert.ok(rankedBuild, "No eligible scored build was found in the smoke-check leaderboards.");

const profile = await readJson(`/api/public/players?uid=${encodeURIComponent(rankedBuild.uid)}`);
assert.ok(Array.isArray(profile.builds), "Player profile response is missing its builds array.");
const profileBuild = profile.builds.find(build => build.id === rankedBuild.id && build.character === rankedBuild.character);
assert.ok(profileBuild, "The current leaderboard build is missing from its player's profile.");
assert.equal(Number(profileBuild.score), Number(rankedBuild.score), "Profile and leaderboard scores disagree.");
assert.equal(Number(profileBuild.data?.assessment?.calculation?.score), Number(rankedBuild.score), "Displayed score disagrees with the stored calculation.");
const echoAsset = await fetch(new URL(`/api/assets/${rankedBuild.id}-1-portrait`, base), { signal: AbortSignal.timeout(20000) });
assert.equal(echoAsset.status, 200, "An approved leaderboard Echo portrait could not be loaded.");
assert.equal(echoAsset.headers.get("content-type"), "image/png", "Echo portrait response has the wrong content type.");
assert.match(echoAsset.headers.get("cache-control") || "", /public, s-maxage=30, stale-while-revalidate=60/, "Approved Echo portrait is not using the short CDN cache.");

assert.ok(Number(rankedBuild.rank) >= 1, "Leaderboard rank is invalid.");
const medalResponse = await readJson("/api/public/players");
assert.ok(Array.isArray(medalResponse.topPlayers), "Player standings response is missing its topPlayers array.");
assert.ok(Number.isFinite(Date.parse(medalResponse.topPlayersUpdatedAt)), "Medal standings update time is invalid.");
for (const player of medalResponse.topPlayers) {
  const gold = Number(player.gold), silver = Number(player.silver), bronze = Number(player.bronze);
  assert.ok([gold, silver, bronze].every(Number.isFinite), `Medal counts are invalid for UID ${player.uid}.`);
  assert.equal(Number(player.total), gold + silver + bronze, `Medal total disagrees for UID ${player.uid}.`);
  assert.equal(Number(player.points), gold * 3 + silver * 2 + bronze, `Weighted medal points disagree for UID ${player.uid}.`);
}


console.log(JSON.stringify({
  ok: true,
  release: health.release,
  database: health.database,
  checked: ["health", "leaderboard-to-profile build identity", "leaderboard-to-profile score", "stored calculation score", "rank"],
  character: rankedBuild.character,
  buildId: rankedBuild.id,
  rank: rankedBuild.rank,
}, null, 2));
