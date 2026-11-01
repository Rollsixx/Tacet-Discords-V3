export function orderProfileBuildsByRank(builds) {
  return [...builds].sort((left, right) => {
    const leftRank = Number.isFinite(left.rank) ? left.rank : Number.POSITIVE_INFINITY;
    const rightRank = Number.isFinite(right.rank) ? right.rank : Number.POSITIVE_INFINITY;
    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftScore = Number.isFinite(left.score) ? left.score : Number.NEGATIVE_INFINITY;
    const rightScore = Number.isFinite(right.score) ? right.score : Number.NEGATIVE_INFINITY;
    if (leftScore !== rightScore) return rightScore - leftScore;

    return String(left.character || "").localeCompare(String(right.character || ""))
      || String(left.id || "").localeCompare(String(right.id || ""));
  });
}
