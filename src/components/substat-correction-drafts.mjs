/** Return a stable key for one Echo substat correction draft. */
export function correctionDraftKey(slot, position) {
  return `${slot}:${position}`;
}

/** Update one field draft without disturbing edits for other Echo slots. */
export function updateCorrectionDraft(drafts, key, patch) {
  const previous = drafts[key] ?? { type: "DEF:percent", value: "", note: "" };
  return { ...drafts, [key]: { ...previous, ...patch } };
}

/** Clear only the correction that was successfully saved. */
export function clearCorrectionDraft(drafts, key) {
  if (!(key in drafts)) return drafts;
  const next = { ...drafts };
  delete next[key];
  return next;
}
