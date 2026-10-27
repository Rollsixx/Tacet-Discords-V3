export type CostRead = { text: string; confidence: number };

// A cost is recovered only when two separate image reads agree. Never infer it
// from the slot, main stat, another Echo, or the remaining cost budget.
export async function recoverEchoCost(
  primary: { raw: string; value: string },
  readVariant: (variant: 0 | 1) => Promise<CostRead>,
) {
  if (/^[134]$/.test(primary.value)) return primary;
  const first = await readVariant(0);
  const second = await readVariant(1);
  const a = first.text.trim(), b = second.text.trim();
  if (/^[134]$/.test(a) && a === b &&
      first.confidence >= 65 && second.confidence >= 65) {
    return { raw: primary.raw, value: a, autoRecovered: true };
  }
  return primary;
}
