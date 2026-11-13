# Bug: Healing Light dice-pool commit on a full-HP target consumes the die and logs the roll as HP restored when nothing was restored

## Summary
`HealingPoolModal`'s dice-pool path (CelestialWarlock **Healing Light**) lets you roll and commit dice against a target that is already at max HP. The pool die is spent, the in-modal copy says “`Rolled 1d6: 6 = 6 HP to restore`”, and a `healing_pool` log row is minted with `amount:<roll>` — but the actual HP restored is 0 (write collapses to the unchanged value / is never made). The combat ledger therefore over-reports healing. Contrast: the same suite's Hand of Healing lane annotates its audit row honestly (`(Already at full HP)`), so the two heal lanes treat the identical situation with different honesty.

## Steps to reproduce
Starting in test-campaign on a freshly-selected campaign (cleared change-data is cleanest; any untouched character works):

1. Ensure a combat board exists (join any monster via Encounter Builder so the party rows fan out, or seed a hand-rolled `combatSummary`). Reload + re-select so mirrors hydrate. An untouched target like `AasimarTest` has a bucket with `hitPoints:143` and NO `currentHitPoints` key — its mirror reads full (143/143).
2. Open CelestialWarlock's sheet → click the `Healing Light:` Special Actions row → in the target-chooser pick the full-HP target (or Skip for self, also full) → `Heal`.
3. Roll view shows e.g. `Roll Dice — AasimarTest (143 / 143 HP) (Max 4 dice)` — i.e., the target is visibly at max.
4. Press `Roll a d6` → modal reports `Rolled 1d6: 6 = 6 HP to restore`, pool ticks 20/21. Press `Done`.
5. `GET /api/campaigns/test-campaign/change-data`: `AasimarTest` bucket still has NO `currentHitPoints` key (0 HP actually restored); `CelestialWarlock.healinglightPool` HAS been decremented. `GET …/log`: a row exists — `{"type":"healing_pool","sourceName":"CelestialWarlock","featureName":"Healing Light","targetName":"AasimarTest","amount":6,"diceUsed":1,"rolls":[6],"poolAfter":19}`.
6. CONTROL (lane works on damaged targets): damage the target first (e.g. scoped PATCH `AasimarTest {value:{currentHitPoints:110}}`, reload + re-select), repeat → roll 6 → `Done` → bucket `currentHitPoints` 110→116, pool 19→18, row `amount:6` — all consistent.

## Expected behavior
Committing against a target at max HP should either (a) refuse before the die is spent with visible feedback (“target is already at full HP”), or (b) clamp honestly: log `amount:0` (or an `(Already at full HP)` annotation like the monk lane), and return/not consume the die. The modal’s “N HP to restore” copy must not promise restoration it cannot deliver.

## Actual behavior
Die spent, over-reporting log row minted (`amount:6`, no annotation), zero HP delta anywhere, no console error, no failed request, no inline notice. The roll view even DISPLAYS `(143 / 143 HP)` at step 3 and still lets the spend proceed.

## Likely location
`src/components/char-sheet/modals/divine/HealingPoolModal.jsx` — `applyAccumulatedHealing` (~lines 476–505): it computes `newHp = Math.min(targetMax, targetCurrentHp + accumulatedTotal)` then unconditionally spends (`setPoolRemaining`), logs, and writes — with no `actualHeal = newHp − targetCurrentHp` clamping/annotation (the amount path and the Hand-of-Healing handler both have richer handling: `healingHandler` logs `(Already at full HP)`, and the combat lane `applyHealingToTarget` returns an `actualHeal`). Confident on the component; the fix belongs in the dice path mirroring the amount path's honesty.

## Secondary verified law (context, not a separate bug)
Heal writes (both lanes) only ever touch the bucket `currentHitPoints`; the `combatSummary` creature rows never move (GET-verified: cs `AasimarTest.currentHp` stayed 100 while the bucket healed 110→116→134 across three commits). Target-choosers built from `combatSummary` rows (`SecondaryTargetModal` via `collectTouchTargets`) can therefore offer HP that contradicts the bucket truth inside one flow. Filed separately as an improvement/UX-drift note in the exploration backlog.

## Severity
**Data integrity risk (minor-to-moderate):** the shared campaign log is the party's record of resource expenditure; it records 6 HP restored that never happened, and the pool die is silently lost. Fully silent — no feedback distinguishes it from a successful heal.
