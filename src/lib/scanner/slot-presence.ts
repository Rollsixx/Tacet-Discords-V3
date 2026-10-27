// Conservative evidence check: no guessed identity or cost for an empty background.
export function hasEchoText(cost: string, main: string, lines: string[]) {
  if (/^[134]$/.test(cost.trim())) return true;
  const statWord = /\b(atk|def|hp|crit|dmg|bonus|regen|healing)\b/i;
  if (statWord.test(main)) return true;
  return lines.some(line => statWord.test(line) && /\d/.test(line));
}
