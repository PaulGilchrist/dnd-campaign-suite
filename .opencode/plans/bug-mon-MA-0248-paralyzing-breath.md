# Bug MA-0248 — Ancient Silver Dragon "Paralyzing Breath": flat Incapacitated+Paralyzed on first failed save; no staging ladder

## Overview
MA-0248 (actions[3], aoe-save, DC 24 Constitution, no recharge, 90-ft cone). The row authors a two-stage escalation (first fail → Incapacitated until end of next turn + repeat save; second fail → Paralyzed, repeat each turn, auto-success after 1 minute). The app has NO staging producer for this row: on the FIRST failed save it applies BOTH conditions flat and simultaneously, with no repeat-save ladder, no expiry, and no escalation logic. Same fingerprint as MA-0068/MA-0179/MA-0182 pre-fix sleep breaths — this row was never given the `staged_sleep`-style data flags and no non-sleep condition-staging engine exists.

## Expected (quote row)
"Constitution Saving Throw: DC 24, each creature in a 90-foot Cone. First Failure: The target has the Incapacitated condition until the end of its next turn, when it repeats the save. Second Failure: The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically."

## Actual (live, test-campaign 2026-09-15)
- First-fail (HW 16+0, EP 12+10 vs DC 24): BOTH targets immediately got `activeConditions: ['incapacitated','paralyzed']` + `activeConditionMeta` {dc:24, ability:con, source:dragon} on both conditions at once. No staging key (no staged/incapacitated-until-next-turn), no targetEffects, no pendingExpirations.
- Picker/prompt copy is flat: "On a failed save, target is Incapacitated, Paralyzed." + "Half damage on successful save" boilerplate on a zero-damage row (MV-19 family cosmetic).
- Condition log: `condition applied` per target, "Incapacitated, Paralyzed until the end of its next turn, when it repeats the save (GM-enforced)" — prose claims the ladder, engine has none.
- Walked initiative past HW's turn end (round 14): zero auto repeat-save (pendingSavePrompts/pendingSaveListenerPrompts stayed 0), no escalation/removal — conditions persist indefinitely.
- Only removal seam is GM badge click (`.creature-badge` → `.condition-save-result` via createRollConditionSaveHandler): success strips that one condition only (EP Paralyzed cleared, Incapacitated orphaned — its "until end of next turn" never expires because no expiry registrant).
- Repeat uses are ungated (no recharge authored — correct, 2nd click fires).
- Success leg clean: EP success 19+5=24 vs DC 24 → zero effect, zero damage/hp_change entries across all uses (`applySaveFailConditions` early-returns on success, SaveAttackAoeModal.jsx:377). Badge-seam success logs nothing to campaign log (logging gap).
- "Auto-success after 1 minute": no 1-minute clock consumer precedent (§7); even rounds:10 expiry is never registered for these conditions.

## Steps
1. test-campaign: dragon (cs idx0) + HW (CON+0) + EP in initiative; dragon card → Paralyzing Breath "DC 24 Constitution" chip → picker check HW+EP → confirm → Roll Save×2 → Done.
2. curl `/api/campaigns/test-campaign/change-data`: both targets hold ['incapacitated','paralyzed'] after ONE failed save.
3. Walk Next past HW's turn end: no prompt, no escalation, conditions unchanged.
4. Click EP Paralyzed badge → success → only Paralyzed removed; Incapacitated persists forever.

## Likely Location
- `src/components/encounter/MonsterCardModal.jsx:141-143` — `sleepStagingForAction` returns null unless `action.staged_sleep`; Paralyzing Breath row has no such flag (monsters.json ancient-silver-dragon actions[3] has none) → routes to the MA-0063 one-shot grant `applySaveFailConditions` (SaveAttackAoeModal.jsx:376-418) which merges ALL extracted conditions at once (`extractConditionsFromSaveEffect` matches both "Incapacitated" and "Paralyzed", MonsterCardHelpers.js:181-191).
- Fix shape = data + engine: row needs `dc_success:"none"` + a staging flag; engine needs a generic staged-condition producer (sleep-staging analogue: `sleep_staged` te + turn-END repeat-save consumer in navigationHandlers/applySleepTurnEnd) keyed to a non-sleep escalation ladder; plus turn-end "until next turn" expiry registrant for the Incapacitated stage. 1-min auto-success could ride rounds:10 clock (CLA-334 minutes×10).

## Notes
- MA-0245's "(A) Paralyzing Breath PASS" note predates this row's exact staging criterion; its own evidence ("Incapacitated, Paralyzed" simultaneous log) is exactly the FAIL fingerprint under MA-0068 comparison.
- 45 log entries across all uses contain zero damage/hp_change → no dc_success:'half' damage leak (row damageless; leak is prose-only).
