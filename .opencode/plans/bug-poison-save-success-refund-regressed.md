# Bug: Devious Strikes Poison save-SUCCESS refunds the 1d6 Cunning Strike cost (full sneak pool dealt) — regression/recurrence on HEAD 616289b98

## Summary
When a Cunning Strike (Devious Strikes) **Poison** rider's target SUCCEEDS its CON save, the cost
ledger row "Forgoing 1d6 Sneak Attack damage dice for Cunning Strike cost." is logged, but the
damage step that lands afterwards rolls the FULL sneak pool (10d6, 11 dice) instead of the
cost-reduced pool (9d6). The same session's control faces all deduct correctly, so the leak is
specific to the Poison-on-save-SUCCESS lane. This is the exact claim filed 2026-11-06 (DH) and
later marked DISPROVED (5949aa22b, 4 cycles all rolled 9d6); it reproduced cleanly on current HEAD
(616289b98, after the crit-ledger-shape / VT-copy / spellValidation improve trio), so it is either
a regression or a flaky lane the disproof run under-sampled.

## Steps to reproduce
1. test-campaign, sanctioned Rogue rig (EvasiveFighter → 2024 Rogue/Arcane Trickster lv20 +
   Poisoner's Kit in backpack; 3-creature board with EF attacking ElderPaladin; playbook §7).
2. Stamp EP bucket `activeBuffs [{effect:'warding_bond', saveBonus:+19, ...}]` (dial forcing CON
   SUCCESS vs DC 15; playbook §7).
3. Re-arm sneak (scoped PATCH `combatSummary {round:N}`), press Scimitar until a HIT opens the
   Devious Strikes chooser; tick **Poison** → Apply Effects → Roll Save (EP succeeds, ~+29 total)
   → Done; Cancel the queued Charge chooser; drain remaining prompts/popups to CLEAR.
4. Read the final damage popup + campaign log tail.

## Expected behavior
Cost is paid regardless of the save outcome (the chooser copy says "Cost: 1d6 Sneak Attack dice"
and the Forgoing ledger row is written): damage formula must show `9d6 [Sneak Attack]` with 10
rolls, as on every other face.

## Actual behavior
Log tail for the cycle (exact order):
1. `ability_use` "Forgoing 1d6 Sneak Attack damage dice for Cunning Strike cost."
2. `save_result` "ElderPaladin succeeded CON save (DC 15, rolled 3 +29 = 32 — full success)"
3. `ability_use` "Poison applied to ElderPaladin — ... succeeded — no effect"
4. `roll` formula `1d6+3 [slashing] + 10d6 [Sneak Attack]`, **rolls length 11** (1 base + FULL
   10-dice sneak), total 41 → `hp_change` 82→41.
Same-tab controls, all DEDUCT correctly on current HEAD: Trip-save-SUCCESS → `9d6`/10 rolls;
Poison-save-FAIL → `9d6`/10 rolls; Daze (2d6) → `8d6`/9 rolls. Only Poison-on-save-SUCCESS refunds.
(The previous file `resolved/bug-poison-save-success-refunds-cunning-strike-cost.md` was closed as
disproved with a healthy-success fingerprint of `9d6`/10 rolls — that face did NOT appear this run.)

## Likely location (hypothesis-flagged)
`src/services/combat/steps/attackRollDamageCalc.js` `buildSneakAttackStep` reads the paid cost from
runtime `_cunningStrikeCostUsed` (line ~144) when the damage stage RESUMES after the rider-save
prompt chain. The save-success path (rider eviction 4980f9e7f / "succeeded — no effect" branch) or
a full-store runtime snapshot during the prompt pause can reset/lose `_cunningStrikeCostUsed`
before this late read → `cost 0`, full pool dealt. The two-channel merge law (mergeModalStates) and
the `_cunningStrikeCostUsed` resurrection note (playbook §4, sheet-modal merge law) show this latch
is already fragile across prompt pauses; the success branch's earlier DONE-click ordering is what
differentiates this face from Trip-success.

## Suggested fix
Investigate the lifecycle of `_cunningStrikeCostUsed` between Apply Effects (cost commit) and the
resumed sneak step, specifically what the Poison save-success resolution writes to the runtime
bucket that Trip-success does not (the poison success branch runs the §5 te eviction + its own
ability_use row). Pin with a pipeline test shaped like `attackRollDamageCalc-crit-ledger-shape.test.js`:
rider success-resolved → sneak step must still see cost=1. Alternatively snapshot the cost into the
pipeline CONTEXT at cost-commit time (ctx is immune to runtime churn) instead of re-reading
runtime in the resumed step.

## Severity
Data integrity risk (damage over-dealt by the full cost dice on every poison-save success; ledger
row lies about the payment). Confirmed live once on HEAD 616289b98 with three in-session option/outcome
controls that all deduct; the prior disproof suggests flakiness, so sample ≥3 success faces when fixing.
