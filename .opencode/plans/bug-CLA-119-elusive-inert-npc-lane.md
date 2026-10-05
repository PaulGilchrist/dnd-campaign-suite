# Bug CLA-119 — Elusive: defender fold inert on NPC→PC lane (hasElusive false — combatSummary player entries lack feature data)

## Title
Elusive (Rogue lv18): the noAdvantageAgainst fold exists and is consumed, but the NPC→PC attack lane computes `hasElusive` from combatSummary player entries that contain no feature lists — so advantage-vs-rogue is never cancelled in combat. Sheet-only setter never runs during NPC attacks.

## Overview
Verified 2026-10-04, test-campaign, host AasimarTest lv20 Rogue (Arcane Trickster, rules 2024; Elusive visible on sheet Special Actions). Control pair prone EvasiveFighter. Adv source proven live; Elusive host still rolls adv anyway.

## Expected Behavior
No attack roll can have Advantage against the rogue unless Incapacitated (classes.json:9843 lv18; 5e twin classes.json:9601).

## Actual Behavior
1. Fold consumed: conditionEffects.js:868 `if (targetEffects.noAdvantageAgainst) adv=0` via combineAttackModes:854 — healthy when the flag is set.
2. Setter 1 (sheet lane): CharSheet.conditionEffects.js:107-118 computes hasElusive from rolled actions/bonusActions/reactions/specialActions name-match 'Elusive', lv18-gated (class_levels[17]) — sets targetEffects.noAdvantageAgainst only when SHEET renders.
3. Setter 2 (NPC→PC modal lane): MonsterCardModal.jsx:840-852 reads `targetComputed` from combatSummary player entries; encounterToInitiative.js:57 builds minimal entries (GET-verified keys: name/type/currentHp/maxHp/initiative/targetName/concentration) → hasElusive ALWAYS false → :2134 forcedMode never engaged; logged mode stays "advantage" (useLoggedDiceRollAttack.js:118).
4. LIVE FAIL: Goblin 1 Scimitar, Faerie Fire te (live adv), same round: vs prone EvasiveFighter → `rolls [2,17] mode:"advantage"` (control correct); vs AasimarTest → `rolls [5,5] mode:"advantage"` — NOT cancelled; tracker badge "Adv vs", no "No Adv vs".
5. Incapacitated exemption: CONDITIONS_THAT_CANNOT_ACT (:114/:848) grep-present, no clean UI lane — advisory.

## Steps to Reproduce
1. test-campaign; EB "Join Encounter" Goblin 1 (only attack-capable tracker lane — "+NPC" has no attacks).
2. EffectAdder Effects tab → Faerie Fire te on AasimarTest (conditions-tab prone is a DEAD adv lane — addCondition never writes creature.conditions, control logged mode:normal).
3. Goblin 1 card → Target=Elusive host → Scimitar attack → ledger mode:"advantage" (bug). Same vs control non-rogue → also advantage (expected for control).

## Likely Location
- MonsterCardModal.jsx:840-852 — compute hasElusive from full playerStats (PlayerStats/rolled features) not combatSummary stub entries; or stamp `noAdvantageAgainst` onto combatSummary entries at init from character computed stats (encounterToInitiative.js:57).

## Notes
- Logs `rolls:[a,b]` are always two d20 for adv rolls; `mode` field is the authority.
- 5e twin lv18 untested (no lv18 5e rogue). Cleanup verified: effects/conditions removed GET-empty, Admin cleared change-data+log, characters/NPC/encounter files untouched. Verified 2026-10-04.
