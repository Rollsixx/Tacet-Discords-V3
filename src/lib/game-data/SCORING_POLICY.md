# Tacet scoring policy 2

The metric is expected standardized damage, not DPS, optimal gameplay, anti-cheat certification or a Kuro Games official score. Categories are separate per character. Level90, talents10, S0, signature90/R1, max-level five-star Echoes, permanent passives only, no team buffs, enemy90/Calamity/10% resistance apply to every category.

Carlotta, Cartethyia and Aemeath use the first pinned upstream rotation preset. Hiyuki and Chisa have no upstream rotation presets, so Tacet defines explicit **damage windows**, with normalized starting resources and preparation damage excluded. These authored windows do not claim to be complete zero-resource rotations. Their origin and starting conditions are displayed with every calculation.

## Hiyuki: Foreclaimed Self window

Start already in Foreclaimed Self, with Frostheart300, Frostharden Iai3, Whiteout Bitterfrost0 and Snowforged Blade0. Use Foreclaimed basic stages1–5, Jade Cleave once, Iai three times, Bitterfrost once and Blade Liberation once. Normal attacks/Jade Cleave cannot exceed the Frostheart cap; the three Iai consume300 Frostheart and three Frostharden Iai, generating three Whiteout stacks. Bitterfrost consumes those three stacks and grants one Snowforged Blade. The finisher uses its base multiplier; the conditional Snowforged bonus and Glacio Bite/status-proc damage are excluded by this policy. No Intro/Outro or preparation attacks are counted.

## Chisa: Chainsaw window

Start in normal mode, Ring of Chainsaw100 and full Liberation energy. Use Moment of Nihility, Serrated Loop, Blitz Stage2, Blitz Stage3 and Eradication. Serrated Loop enters Chainsaw Mode; pressing Normal chains directly into Stage2, which continues into Stage3 and Eradication. Hold extensions, dodge counters, partial-animation cancellation, preparation, Intro/Outro and status-proc damage are excluded. Convergence and consumed-Ring multiplier increases are conditional and excluded by the permanent-passive policy. This is a defined base-damage window, not a full-buff combat simulation.

## Sources and checks

Attack keys, level10 coefficients and transition descriptions come from the pinned GPL reference source in vendor/wuthering-tools/scoring-source.tar.gz: src/characters/Hiyuki/{basicAttacks,skillAttacks,liberationAttacks,forteCircuitAttacks}.ts and the equivalent Chisa files. No new coefficients, timings, resource generation amounts or DPS durations are invented. Frozen five-card cases, source OCR/identity checks and independent hit-core comparisons cover the two authored windows. The independent comparisons verify arithmetic and action aggregation, not independent in-game measurements or optimal rotations.

Engine2/policy2 prevents mixing previous results with these definitions. The startup/rescore command upgrades only retained, previously server-validated evidence from the known source snapshot. It skips unverifiable old submissions; those can be resubmitted with originals. Original images remain discarded after validation. Player verification can be revoked after approval and takes effect on rankings immediately.
