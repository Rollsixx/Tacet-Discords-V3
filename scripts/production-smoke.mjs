import assert from "node:assert/strict";

const base = (process.env.DEPLOYMENT_URL || process.env.BASE_URL || "").replace(/\/$/, "");
if (!base) throw new Error("Set DEPLOYMENT_URL to the successful production deployment URL.");
const parsed = new URL(base);
if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".vercel.app")) {
  throw new Error("Refusing production smoke checks against a non-HTTPS Vercel deployment URL.");
}

async function verifyPublicApiCache(path) {
  const url = new URL(path, base);
  let last;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    last = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    const body = await last.text();
    assert.equal(last.status, 200, `${path} returned HTTP ${last.status}: ${body.slice(0, 300)}`);
    const policy = last.headers.get("cache-control") || "";
    assert.match(policy, /public/i, `${path} is not publicly cacheable (Cache-Control: ${policy || "missing"}).`);
    assert.doesNotMatch(policy, /no-store|private/i, `${path} disables intended public caching (Cache-Control: ${policy}).`);
    assert.match(policy, /s-maxage=\d+/i, `${path} is missing a shared-cache lifetime (Cache-Control: ${policy}).`);
    if (/^(HIT|STALE|REVALIDATED)$/i.test(last.headers.get("x-vercel-cache") || "")) return last.headers.get("x-vercel-cache");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.fail(`${path} did not produce a Vercel CDN cache hit (last: ${last?.headers.get("x-vercel-cache") || "missing"}; edge: ${last?.headers.get("x-vercel-id") || "unknown"}).`);
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
  const leaderboardPath = `/api/public/leaderboards?character=${encodeURIComponent(character)}&page=1`;
  const leaderboard = await readJson(leaderboardPath);
  assert.ok(Array.isArray(leaderboard.builds), "Leaderboard response is missing its builds array.");
  rankedBuild = leaderboard.builds.find(build => build && build.uid && build.id && Number.isFinite(Number(build.score)));
  if (rankedBuild) { await verifyPublicApiCache(leaderboardPath); break; }
}
assert.ok(rankedBuild, "No eligible scored build was found in the smoke-check leaderboards.");

const profilePath = `/api/public/players?uid=${encodeURIComponent(rankedBuild.uid)}`;
const profile = await readJson(profilePath);
const profileCache = await verifyPublicApiCache(profilePath);
assert.ok(Array.isArray(profile.builds), "Player profile response is missing its builds array.");
const profileBuild = profile.builds.find(build => build.id === rankedBuild.id && build.character === rankedBuild.character);
assert.ok(profileBuild, "The current leaderboard build is missing from its player's profile.");
assert.equal(Number(profileBuild.score), Number(rankedBuild.score), "Profile and leaderboard scores disagree.");
assert.equal(Number(profileBuild.data?.assessment?.calculation?.score), Number(rankedBuild.score), "Displayed score disagrees with the stored calculation.");

const echoAssetUrl = new URL(`/api/assets/${rankedBuild.id}-1-portrait`, base);
const fetchEchoAsset = () => fetch(echoAssetUrl, { signal: AbortSignal.timeout(20000) });
const echoAsset = await fetchEchoAsset();
assert.equal(echoAsset.status, 200, "An approved leaderboard Echo portrait could not be loaded.");
assert.equal(echoAsset.headers.get("content-type"), "image/png", "Echo portrait response has the wrong content type.");
assert.match(echoAsset.headers.get("cache-control") || "", /public/, "Approved Echo portrait is not publicly cacheable.");

let cachedEchoAsset = null;
for (let attempt = 0; attempt < 5; attempt += 1) {
  if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000));
  cachedEchoAsset = await fetchEchoAsset();
  assert.equal(cachedEchoAsset.status, 200, "A cached approved leaderboard Echo portrait could not be loaded.");
  assert.equal(cachedEchoAsset.headers.get("content-type"), "image/png", "Cached Echo portrait response has the wrong content type.");
  if (/^(HIT|STALE|REVALIDATED)$/i.test(cachedEchoAsset.headers.get("x-vercel-cache") || "")) break;
}
assert.match(
  cachedEchoAsset?.headers.get("x-vercel-cache") || "",
  /^(HIT|STALE|REVALIDATED)$/i,
  `Repeated approved Echo portrait requests did not reach the Vercel CDN cache (last status: ${cachedEchoAsset?.headers.get("x-vercel-cache") || "missing"}; edge: ${cachedEchoAsset?.headers.get("x-vercel-id") || "unknown"}).`,
);

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
  checked: ["health", "leaderboard-to-profile build identity", "leaderboard-to-profile score", "stored calculation score", "rank", "weighted medal tally", "leaderboard API CDN cache hit", "profile API CDN cache hit", "Echo CDN cache hit"],
  profileCache,
  character: rankedBuild.character,
  buildId: rankedBuild.id,
  rank: rankedBuild.rank,
}, null, 2));
