import { test } from "node:test";
import assert from "node:assert/strict";
import { hasEchoText } from "./slot-presence.ts";
test("real empty-slot OCR background readings do not manufacture an Echo", () => {
  for (const [cost, label, ...lines] of [
    ["a", "", "aT", "RE", "al", "", "FEL"],
    ["a", "go", "orl", "WEN", "al TN", "", "RL"],
    ["a", "oo", "TH", "ERE", "j al TT", "", "RL"],
    ["a", "Lo", "TH", "ERE", "j al TT", "", "FEL"],
  ]) assert.equal(hasEchoText(cost, label, lines), false);
});
test("partial readable evidence remains a detected Echo requiring review", () => {
  assert.equal(hasEchoText("4", "", []), true);
  assert.equal(hasEchoText("", "Crit. DMG", []), true);
  assert.equal(hasEchoText("", "", ["HP 470"]), true);
});
