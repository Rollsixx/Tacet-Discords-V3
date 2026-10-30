import {ENGINE_VERSION,DATA_VERSION,POLICY_VERSION,SUPPORTED} from './scoring-versions.mjs';
import {DAMAGE_CORE_VERSION} from './damage-core.ts';
import {OWNER_ROTATION_REQUIRED} from '../game-data/scoring-policies.mjs';
export const scoringReadiness = {
  enabled: true,
  reason: "Versioned permanent-passive S0/signature-R1 damage benchmark. Only approved, identity-verified builds with source-validated inputs are ranked.",
  engineVersion: ENGINE_VERSION, numericCoreVersion: DAMAGE_CORE_VERSION,
  dataVersion: DATA_VERSION, policyId: POLICY_VERSION, supportedCharacters: SUPPORTED, ownerRotationRequired: OWNER_ROTATION_REQUIRED,
  metric: "Expected standardized benchmark damage (not DPS)",
  missing: [],
};
