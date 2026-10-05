# Bug — CLA-092 Divine Spark: harm damage never applied; healing writes NaN; save DC wrong

## Title
Divine Spark (CLA-092) — failed-save harm applies ZERO damage to target (no hp_change), healing writes NaN/null to currentHitPoints, and save DC is hardcoded 8+WIS+2 (ignores caster proficiency).

## Overview
CLA-092 "Divine Spark" (2024 Cleric Channel Divinity) triggers correctly from the War_Cleric sheet: feature row, Heal/Harm chooser, Necrotic/Radiant radio, save prompt, CD charge ledger, and 0-charge gate all work. But both resolution legs are broken:
1. Harm: damage is rolled but never applied — target HP unchanged on failed save; no `hp_change` log entry.
2. Heal: `applyHealingDirectly` is called without the target's maxHP, so `Math.min(undefined, hp+amount)` = NaN; runtime `currentHitPoints` is overwritten to NaN (serialized `null`) and the log `delta` is null.
3. DC: modal computes `8 + wisModifier + 2` — proficiency hardcoded +2. War_Cleric lv8 (PB+3, WIS+4) shows DC 14; its own spell Save DC (divine focus) is 15.

## Expected (canonical, public/data/2024/classes.json, Divine Spark feature)
"As a Action, you point your Holy Symbol at another creature you can see within 30 feet of yourself and focus divine energy at it. Roll 1d8 and add your Wisdom modifier. You either restore Hit Points to the creature equal to that total or force the creature to make a Constitution saving throw. On a failed save, the creature takes Necrotic or Radiant damage (your choice) equal to that total."
→ Heal: ally currentHitPoints += 1d8+WIS (clamped at max). Harm fail: target HP −= same total, correct type, hp_change logged, DC = 8+PB+WIS = 15.

## Actual (live, test-campaign, War_Cleric lv8 WIS+4 PB+3, 2024)
- Heal leg (target LightfootHalfling at 5/12): modal "healed for 6 HP. Roll: 1d8 + 4 = 6. Current HP: NaN / (healed NaN)". GET change-data: `LightfootHalfling.currentHitPoints = null` (was 5). Log `hp_change delta:null currentHp:null`. HP NOT restored.
- Harm leg (target Bandit 1, CON save +1): save prompt "DC 14" (wrong; sheet Save DC 15). Roll d20(2)+1=3 → SAVE FAILURE. Modal: "Bandit 1 takes 8 Radiant damage. Damage roll: 1d8 + 4 Radiant = 8". GET combatSummary: Bandit `currentHp 11 → 11`. No hp_change log for Bandit. save_result entry lacks damageType/rawDamage fields.
- Full-target heal (AasimarTest 143/143): no undamaged-target gate; same NaN corruption (`AasimarTest.currentHitPoints → null`).
- Working parts: Heal/Harm buttons + Necrotic/Radiant radio (button label updates Harm→Radiant on selection), CD spend `channelDivinityCharges` 3→2→1→0 (GET, one per activation), 0-charge refusal popup "No Channel Divinity charges remaining." with zero effect/log delta, save prompt + roll math (DC vs d20+CON bonus) works, save-success=zero damage vacuously (damage never lands at all).

## Repro steps
1. localhost:5173 → test-campaign; Admin → Full Reset (clean).
2. Encounters → search "Bandit" → tick Bandit → Join Encounter (initiative: all PCs + Bandit 1).
3. Initiative → LightfootHalfling card HP input → 5.
4. Arm target on War_Cleric's init card `[data-testid="target-select"]` → LightfootHalfling.
5. War_Cleric sheet → Actions → click "Divine Spark:" → modal (target LF, Heal (1d8 + 4)) → Heal.
   → Observe "Current HP: NaN / (healed NaN)"; GET change-data LF currentHitPoints null.
6. Re-arm War_Cleric → "Bandit 1  " (trailing spaces). Sheet → Divine Spark → select Radiant radio → Harm.
   → Observe save prompt DC 14 (should be 15); Roll Save; on failure modal claims damage; Bandit combatSummary currentHp unchanged 11.
7. CD ledger: GET change-data → channelDivinityCharges decrements per activation; at 0 → refusal popup.

## Likely Location
- `src/components/char-sheet/modals/divine/DivineSparkModal.jsx:98` — `saveDc = 8 + wisModifier + 2` (hardcoded PB+2; should be caster `proficiency`, e.g. via playerStats or the sheet's spell save DC 15).
- `src/components/char-sheet/modals/divine/DivineSparkModal.jsx:54-59` — `applyHealingDirectly({ name: targetName }, targetName, healAmount, campaignName)` passes no `targetMaxHp` and a fake playerStats → `healingRoll.js:48` `maxHp = targetMaxHp ?? playerStats.hitPoints` = undefined → `Math.min(undefined, …)` NaN.
- `src/components/char-sheet/modals/divine/DivineSparkModal.jsx:110-151` — harm path: `createSaveListener` payload omits `rawDamage/damageFormula/damageType` and `handleSaveResult` never calls any damage-application service → zero damage on failed save, no hp_change.
- Secondary: `divineSparkHandler.js:31` spends CD at activation (no refund on modal Cancel) — matches CLA-063 known pitfall; `divineSparkHandler.js:8` default max charges 2 vs sheet 3/3 at lv8.

## Notes
- Bandit saveBonuses in combatSummary: con +1 (task brief said CON+0; irrelevant to verdict).
- save-damage roll log (`rolls:[2]` die-count, DC 14) matches modal lane convention.
- Console: no new errors (only pre-existing `findFeat Boon Of Fortitude` debug error from AasimarTest).
- Campaign left clean: Admin Full Reset, GET `change-data {}`, `log []`.

## Verdict
FAIL (bugs a/b/c above; core chooser/spend/gate lanes implemented and functional).
