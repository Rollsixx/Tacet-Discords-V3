export const HALL_OF_FAME_MATCH_STATES = Object.freeze([
  "upcoming",
  "ready",
  "on_hold",
  "setting_up",
  "live",
  "complete",
]);

const ORDER_3 = Object.freeze([
  ["a", "ban"], ["b", "ban"], ["b", "pick"], ["a", "pick"],
  ["a", "ban"], ["b", "ban"], ["b", "pick"], ["a", "pick"],
  ["a", "ban"], ["b", "ban"], ["b", "pick"], ["a", "pick"],
]);

const ORDER_4 = Object.freeze([
  ["a", "ban"], ["b", "ban"], ["a", "ban"], ["b", "ban"],
  ["b", "pick"], ["a", "pick"], ["a", "ban"], ["b", "ban"],
  ["b", "pick"], ["a", "pick"], ["a", "ban"], ["b", "ban"],
  ["b", "pick"], ["a", "pick"],
]);

const ORDER_DISCORD = Object.freeze([
  ["a", "ban"], ["a", "ban"], ["b", "ban"], ["b", "ban"],
  ["a", "pick"], ["b", "pick"], ["a", "ban"], ["b", "ban"],
  ["a", "pick"], ["a", "pick"], ["b", "pick"], ["b", "pick"],
]);

export function draftOrder(bansPerPlayer, discordRules = false) {
  if (discordRules) return ORDER_DISCORD;
  if (Number(bansPerPlayer) === 3) return ORDER_3;
  if (Number(bansPerPlayer) === 4) return ORDER_4;
  throw new Error("Bans per player must be 3 or 4.");
}

export function initialMatchPhaseState({ winnerId = null, participantA = null, participantB = null } = {}) {
  if (winnerId) return "complete";
  return participantA && participantB ? "ready" : "upcoming";
}

export function validateDraftStep({
  history,
  stepNumber,
  actorSlot,
  action,
  resonator,
  bansPerPlayer,
  bossChosen,
  startedWithoutDetails,
  discordRules = false,
}) {
  const order = draftOrder(bansPerPlayer, discordRules);
  const next = history.length + 1;
  if (Number(stepNumber) !== next) throw new Error(`Enter draft step ${next} next.`);
  if (next > order.length) throw new Error("The draft is already complete.");
  if (!bossChosen && !startedWithoutDetails) throw new Error("Choose a boss before the first draft step.");
  const expected = order[next - 1];
  if (actorSlot !== expected[0] || action !== expected[1]) {
    throw new Error(`Step ${next} must be Player ${expected[0].toUpperCase()} ${expected[1]}.`);
  }
  const name = typeof resonator === "string" ? resonator.trim() : "";
  if (!name || name.length > 64) throw new Error("Choose a supported Resonator.");
  if (history.some((step, index) => Number(step.step_number) !== index + 1)) {
    throw new Error("Draft history is incomplete. Reload before continuing.");
  }
  const normalized = (value) => String(value || "").trim().toLocaleLowerCase("en-US");
  const chosen = normalized(name);
  const bans = history.filter((step) => step.action === "ban").map((step) => normalized(step.resonator));
  const picks = history.filter((step) => step.action === "pick");
  if (action === "pick") {
    if (bans.includes(chosen)) throw new Error("A banned Resonator cannot be picked by either player.");
    if (picks.some((step) => step.actor_slot === actorSlot && normalized(step.resonator) === chosen)) {
      throw new Error("A Resonator cannot be picked twice by the same player.");
    }
    if (picks.filter((step) => step.actor_slot === actorSlot).length >= 3) {
      throw new Error("A team can contain at most three Resonators.");
    }
  } else if (picks.some((step) => normalized(step.resonator) === chosen)) {
    throw new Error("A picked Resonator cannot be banned.");
  }
  return { stepNumber: next, actorSlot, action, resonator: name };
}


/** @param {unknown} targetSlot @param {unknown} sourceOrder @returns {"participant_a" | "participant_b"} */
export function advancementSlot(targetSlot, sourceOrder) {
  if (targetSlot === "participant_a" || targetSlot === "participant_b") return targetSlot;
  return Number(sourceOrder) % 2 === 1 ? "participant_a" : "participant_b";
}
