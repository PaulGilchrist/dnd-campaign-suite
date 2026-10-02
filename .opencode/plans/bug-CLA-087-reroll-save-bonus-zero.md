# CLA-087 Disciplined Survivor — reroll resolves with saveBonus 0

## Title
Monk "Disciplined Survivor" reroll drops the save modifier — reroll adjudicates as raw d20 + 0.

## Overview
All-saves proficiency, failed-save detection, reroll affordance, Focus cost (exactly −1), zero-focus gating and half-damage ledger are all LIVE-EXACT on test-campaign host Disciplined_Monk lv18. The reroll itself, however, recomputes the save WITHOUT the character's save bonus: first save logged +10 (WIS +4 + PB +6), reroll logged "d20 (19) + 0". The die face happened to cover DC 19 alone, so the outcome was accidentally right; any reroll face 8–18 would adjudicate FAILURE where RAW says SUCCESS (e.g. 18+10=28 ≥ 19).

## Expected (app-data quote)
`public/data/2024/classes.json` classes[5]=Monk, class_levels[13].features[0] (BASE Monk lv14):
> "Disciplined Survivor" — "Proficiency in all saving throws. When you fail a saving throw, expend 1 Focus Point to reroll it."
> automation: {"type":"auto_reroll","trigger":"failed_saving_throw","target":"saving_throw","resourceCost":"focus_points"}

A reroll re-makes the same saving throw → same save bonus (+10 here) applies to the new die.

## Actual (live, 2026-10-02)
- First save prompt (.sp-overlay): WIS DC 19, Roll Save → "SAVE FAILURE Total: 15 vs DC 19 d20 (5) + 10".
- Reroll clicked ("Reroll Save (1 Focus Point)") → panel: "SAVE SUCCESS Total: 19 vs DC 19 **d20 (19) + 0** (-1 Focus Point)".
- Log `save-damage` note `disciplined_survivor_reroll`: `saveBonus: 0, total: 19, rawRolls:[19,19]`; caster `combined_save_damage_roll` `modifier: 0 bonusDetail:'(-1 Focus Point)'`.
- Focus 1→0 exact (single net spend despite double write — both writers write the same stale closure value).
- Second failed save with focus 0: only "Done" — no reroll button (gating works).

## Steps
1. test-campaign, GM. Roll initiative (14 PCs). Hydrate wizard `activeConditions` (GM card Add→condition→Apply; FT-087 throw otherwise burns the slot).
2. Arm wizard initiative card Target dropdown = Disciplined_Monk (scope selector by `.creature-card` exact name — global `cards.find(...)` mis-arms neighbor cards).
3. Set monk Focus tracker to 1 (sheet Focus Points cell → number input → native setter '1' + Enter; GET focusPoints=1).
4. Wizard sheet → Mind Spike (lv2, WIS DC 19 half, single target, damage) → Cast Spell → monk `.sp-overlay` prompt. Roll Save until nat ≤8 (fail).
5. Click `.sp-stroke-btn` "Reroll Save (1 Focus Point)" → panel/logs show reroll bonus 0. GET focusPoints=0. Done.
6. Recast → fail again with fp 0 → panel offers only Done.

## Likely Location
`src/components/common/savePromptHandlers.js:56-63` — `createDisciplinedSurvivorHandler` calls
`doReroll({ campaignName: null, characters: [], activeMapName: null, ... })`; with `characters: []` the `getAbilitySaveBonus` lookup at :13-19 finds no character → `saveBonus` stays 0 (and `computeAuraBonus` loses aura stacking too). Fanatical Focus (:51) and Indomitable (:98) pass the real `campaignName/characters/activeMapName`. Fix = thread them through from `useSaveRerollHandlers` (which already receives them at :8-9).

## Notes
- Availability gate `SavePromptModal.jsx:522` `disciplinedSurvivorAvailable: !fanaticalFocusUsed && currentFocusPoints > 0` has NO class/feature/level check — any character with focusPoints>0 gets the button on any failed save (untriggerable in practice: focus points are Monk-only fallback via class_levels; advisory).
- The double focus write (useSaveRerollHandlers.js:28 + savePromptHandlers.js:60) is idempotent (same stale value) — fragile shape, not a live defect.
- Pass lanes evidenced: sheet save cells + sheet-cell log STR +5 (−1+PB6), INT +6 (+0+6), CON +8; prompt save +10; all-saves proficiency folded via `getAllSaveProficiencies` auto_reroll leg → `abilityCalc2024`.
- Runtime+log admin-cleared after run; wizard long rested (slots); monk focus restores 18/18 (runtime key absent post-clear → class_levels[17].focus_points fallback). Disk untouched.
