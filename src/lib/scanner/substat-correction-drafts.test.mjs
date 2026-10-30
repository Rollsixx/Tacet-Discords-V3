import assert from "node:assert/strict";
import test from "node:test";
import {
  clearCorrectionDraft,
  correctionDraftKey,
  updateCorrectionDraft,
} from "../../components/substat-correction-drafts.mjs";

test("switching between Echoes preserves each unsaved correction independently", () => {
  const echoOne = correctionDraftKey(1, 5);
  const echoTwo = correctionDraftKey(2, 2);
  let drafts = updateCorrectionDraft({}, echoOne, {
    type: "Resonance Liberation DMG Bonus:percent",
    value: "Resonance Liberation DMG Bonus 10.1%",
    note: "Checked against screenshot",
  });

  // Editing the second Echo must not overwrite the first Echo's draft.
  drafts = updateCorrectionDraft(drafts, echoTwo, {
    type: "Crit. Rate:percent",
    value: "Crit. Rate 7.5%",
  });

  assert.equal(drafts[echoOne].value, "Resonance Liberation DMG Bonus 10.1%");
  assert.equal(drafts[echoOne].note, "Checked against screenshot");
  assert.equal(drafts[echoTwo].value, "Crit. Rate 7.5%");
});

test("saving a correction clears only that Echo-position draft", () => {
  const first = correctionDraftKey(1, 5);
  const second = correctionDraftKey(2, 2);
  const drafts = updateCorrectionDraft(
    updateCorrectionDraft({}, first, { value: "ATK 9.4%" }),
    second,
    { value: "Crit. Rate 7.5%" },
  );

  const remaining = clearCorrectionDraft(drafts, first);
  assert.equal(remaining[first], undefined);
  assert.equal(remaining[second].value, "Crit. Rate 7.5%");
});
