export type CostRead = { text: string; confidence: number };

// A cost is recovered only when two separate image reads agree. Never infer it
// from the slot, main stat, another Echo, or the remaining cost budget.
export async function recoverEchoCost(
  primary: { raw: string; value: string },
  readVariant: (variant: 0 | 1) => Promise<CostRead>,
  expected?: string,
) {
  const primaryIsLegal = /^[134]$/.test(primary.value);
  // A legal first OCR result can still be the wrong digit. If it conflicts
  // with the scan, require two confident, independent reads matching that scan
  // before accepting it. Never guess from the remaining Echo cost budget.
  if (primaryIsLegal && (!expected || primary.value === expected)) return primary;
  const first = await readVariant(0);
  const second = await readVariant(1);
  const a = first.text.trim(), b = second.text.trim();
  if (/^[134]$/.test(a) && a === b &&
      first.confidence >= 65 && second.confidence >= 65 &&
      (!expected || a === expected)) {
    return { raw: primary.raw, value: a, autoRecovered: true };
  }
  return primary;
}
