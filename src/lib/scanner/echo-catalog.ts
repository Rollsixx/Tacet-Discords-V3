import catalog from "./echo-catalog-research.json";

export type EchoIdentityCandidate = {
  id: string;
  name: string;
  cost: 1 | 3 | 4;
};

const candidates: readonly EchoIdentityCandidate[] =
  catalog.records as EchoIdentityCandidate[];

export const echoCatalogStatus = {
  researchOnly: true,
  productionReady: false,
  officialScoringEligible: false,
  identityVerified: false,
} as const;

export function listEchoCandidates(): readonly EchoIdentityCandidate[] {
  return candidates;
}

export function findEchoById(
  id: string,
): EchoIdentityCandidate | null {
  return candidates.find((echo) => echo.id === id) ?? null;
}

export function searchEchoCandidates(
  query: string,
): EchoIdentityCandidate[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) return [];

  return candidates.filter((echo) =>
    echo.name.toLowerCase().includes(normalized),
  );
}

export function findEchoCandidatesByCost(
  cost: number,
): EchoIdentityCandidate[] {
  if (![1, 3, 4].includes(cost)) return [];

  return candidates.filter((echo) => echo.cost === cost);
}
