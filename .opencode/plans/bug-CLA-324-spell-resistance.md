# Bug — CLA-324 Spell Resistance (Wizard / Abjurer lv14)

## Overview
Spell Resistance is a real collected feature with a WORKING advantage clause but a COMPLETELY INERT spell-damage-resistance clause. Live E2E 2026-09-06 (test-campaign): the Abjurer lv20 holder made three DEX saves against Gazer Frost Ray (spell, DC 12) and all three rolled `mode:"advantage"` — clause 1 works. On a failed save the holder took the FULL 3d6 cold damage (-14 HP) with no halving, identical to the non-holder control (AberrantSorcerer, `mode:"normal"`, took full -11). The `passive_immunity` automation's `damage_resistance:["Spell"]` token is never matched against any real damage type anywhere in the engine.

## Expected Behavior
App data `public/data/2024/classes.json` [11] Wizard → majors[0] Abjurer → features[5] (level 14): "Advantage on saving throws against spells. Resistance to damage of spells." automation:
1. `{type:'conditional_advantage', target:'saving_throw', condition:'against_spell', effect:'advantage'}`
2. `{type:'passive_immunity', damage_resistance:['Spell']}`
Same text/automation in `public/data/classes.json` Wizard → Abjuration lv14 (canonical 2014 PHB wording). NOTE: 2024 PHB Abjuration lv14 is actually *Spellbane*; app data diverges — judged against app data here.

## Actual Behavior
- Clause 1 PASS live: holder saves vs spell show `saveResult-DivinationWizard {mode:"advantage", rawRolls:[2,15]/[16,17]/[6,9]}` + campaign log `rollType:"save" mode:"advantage"`.
- Clause 2 FAIL live: failed save vs Frost Ray → damage roll 3d6 [5,3,6]=14 → `hp_change delta:-14` (82→73→59 window; rawDamage 14, damageApplied:true). Arcane Ward NOT a factor (`arcaneWardActive` absent/false; ward is a separate lv3 feature). Control: non-holder AberrantSorcerer `mode:"normal"`, failed, took full -11 (44→33). Holder and non-holder behave IDENTICALLY on damage = resistance never applied.

## Steps to Reproduce
1. test-campaign, Encounter Builder → tick Gazer → Join Encounter → walk Next → until activeCreatureName=Gazer 1.
2. Arm Gazer initiative-card target-select = DivinationWizard (Wizard/Abjurer lv20, rules 2024 — qualifies unedited).
3. Gazer card overlay → "3. Frost Ray" (3d6) → Roll Save on prompt: shows d20 twice "(Advantage)". Repeat until SAVE FAILURE (~40%).
4. Observe hp_change = FULL 3d6, no halving line, no 'resistant' resistanceDetails.
5. Control: re-arm target = AberrantSorcerer, same Frost Ray → single d20, mode normal, full damage.

## Grep evidence (clause 2 has zero real consumers)
- `automationInfoBuilder/passive.js:65` maps `damage_resistance` → passive `damageResistance:['Spell']`; `rulesFactory.js:137-147` and `applyDamage.js:174-181` merge `'Spell'` into `playerStats.resistances`.
- `applyDamage.js:36-68` `computeDamageAfterResistances*` matches damageTypes case-insensitively — real spell damage types are `'Cold'`, `'Lightning'`, `'Psychic'`, etc.; NO code anywhere emits damageType `'Spell'` (`rg "'Spell'" src` = popup titles/validation prose only), so `'Spell'` never matches → never halves.
- `automationPassives.js:229 isResistantToDamageType` — ZERO non-test consumers.
- `automationImmunities.js` turns it into `damage:Spell` immunity tokens — `playerIsImmuneToCondition` keys on conditions, not spell-origin damage.

## Likely Location
- Real consumers of clause 1: `src/services/rules/rules.js:174,469` (`saveModifiers=collectSaveModifiers`), `src/components/common/SavePromptModal.jsx:172-183`, `src/hooks/combat/handlers/handleNpcSaveDamage.js:82`, `src/hooks/combat/useLoggedDiceRollSaves.js:193`.
- Clause 2 needs a spell-origin damage gate in `src/services/rules/combat/applyDamage.js` (e.g. flag spell damage on lastAttack/save-damage payloads and halve when target passives include `damageResistance:['Spell']`) — currently absent.
- Manifest paths are FICTITIOUS per playbook: no real files at `src/services/combat/automation/handlers/classFeatureHandler.js`, `routers/classFeatureRouter.js`, `infoBuilders/classFeatureInfoBuilder.js`; real pipeline is automationRouter.js → automationInfoBuilder/passive.js + automationModifiers.js (both route `conditional_advantage`/`passive_immunity` to `result.passives` only — passives bucket has no damage-side consumer for 'Spell').

## Notes
- Clause 1 gate is LOOSE (over-fires): `SavePromptModal.jsx:176` and `handleNpcSaveDamage.js:82` grant the advantage for ANY save (no spell-origin check); probes happened to be spell saves so observed behavior is exact, but non-spell saves would also get advantage.
- `pendingSavePrompts` retains resolved prompt entries after Done (harmless re-display, ghost-hygiene gap).
- Gazer can cast Frost Ray repeatedly (EB unfiltered); Arcane Ward stays inactive unless its bonus-action row is clicked, making Frost Ray a clean resistance probe.
