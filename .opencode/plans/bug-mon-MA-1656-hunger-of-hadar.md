# BUG MA-1656 — Vampire Umbral Lord "Hunger of Hadar" (actions[3]) — FAIL(b)/DATA — 2026-09-30

## Row (disk, monsters.json vampire-umbral-lord actions[3])
{ "name": "Hunger of Hadar", "description": "The vampire casts Hunger of Hadar (level 5 version), requiring no spell components and using Charisma as the spellcasting ability (spell save DC 18).", "save_dc": 18, "save_type": "Charisma" }
Manifest byte-match TRUE. Row has NO damage_dice_primary, NO save_effect, NO range/zone, NO dc_success, NO automation, NO attack_bonus.

## LIVE evidence (test-campaign, dev:locked, localhost only)
- Chip: ONE clickable span "DC 18 Charisma" (mc-dice-link-save-clickable) on Hunger row only (§693 anchor held; Grave/Ray "+10" never pressed). Census-matched, chip NOT dead → not §60 zero-affordance.
- FAIL face (Bandit 1 ability_score_modifiers.cha=-19, §MA-1639 lane):
  - Press 1: nat 20, bonus -19, total 1 < 18 → victim roll log saveResult:"failure", saveDc:18, saveType:"Charisma", dcSuccess:"half". lastAttack{saveResult:failure, attackName:"Hunger of Hadar", isSpellDamage:true, saveConditions:[]}.
  - Press 2: nat 12, total -7 → failure. 2/2.
  - DAMAGE: ZERO on both fails — no save-damage entry, no hp_change, Bandit cs hp 999/999 unchanged. Spell 4d6 Cold / acid leg NEVER adjudicated.
  - CONDITIONS/ZONE: zero — victim cd key 'Bandit 1' KEY-ABSENT (§1116) on every leg; no Blinded, no te, no zone, no concentration, no picker (breathAoeShape(action,null)=null — NO 20-ft sphere affordance despite spell row area_of_effect sphere 20-foot-radius).
- SUCCESS face (cha=+19): nat 7, total 26 ≥ 18 → saveResult:"success"; zero-state both faces (§1116 absent-key proof); dc_success:"half" stamped = §523 half-default, cosmetic only (no damage exists to halve).
- Console: 0 errors (2 harness warnings).
- Popup defect twin: result popup prints "DC Unknown — no success or failure" (DiceRollResult.jsx:375, §138/MA-1546 cosmetic twin) while machine log honestly holds DC 18 + verdicts; success popup also prints "+19 to hit" hit-label noise.

## Cast-lane diagnosis (disk-proven, no live surprise)
Row name ≠ "Spellcasting" → SpellOrSaveLinks → ActionSaveRoll (MonsterAction.jsx:375). Chip press → onSaveRoll(action, formula, saveConditions) 3-arg — spellInfo UNDEFINED → executeBlockSaveRoll (MonsterCardModal.jsx:403) reads ROW-LOCAL fields only: saveType=action.save_type, formula=extractDamageDiceFromDescription(description) → NULL (no "Hit/Failure/Success: N (XdY)" token, no dice text). findMonsterSpell (:1352, 5e-first with 2024 fallback) is NEVER called on this lane; the 2024 hunger-of-hadar row (4d6@lv5, dex save, dc_success:none, sphere 20ft, Blinded) is fully resolvable but unreachable from this chip.

## Fingerprint
§MA-1546 (succubus Charm) successor, strengthened: save chip fires + DC enforced, but row authors no save_effect AND no damage pool → extractConditionsFromSaveEffect(undefined)=[] (Helpers:377) → saveProcessing early-return → failed save produces ZERO outcome vs RAW (lv5: 4d6 Cold start-of-turn + 4d6 Acid end-of-turn save, 20-ft sphere, Blinded, concentration 1min) = FAIL(b)/DATA.

## Fix proposal (NOT applied — verification-only session)
One-row DATA authoring on actions[3] (chip lane supports row-local legs):
- save_type:"Dexterity" + dc_success:"none" (spell row dc{DEX,none}; stat-block "Charisma" is the DC source, not the save axis — even the existing save_type is RAW-misaligned vs its own spell row).
- save_damage_dice (or damage_dice_primary):"4d6" + damage_type Acid (lv5 pool the save leg CAN own) — start-of-turn auto Cold pool + sphere zone + Blinded + concentration + repeat-save stay §70/§87 zero-consumer advisories (MA-0875 Hunger-of-Yeenoghu precedent: zone/repeat/darkness GM-enforced even after fix).
- Optional zone:{radius_ft:20, no_save:false, effect_key:"hunger_of_hadar", advisory} per MA-1251/§378 zone-row shape if sphere persistence is desired (te registration required; te alone never ticks §367 rule).
- Code seam gap worth ticket: ActionSaveRoll never threads spellInfo, so spell-name save rows can't pull their own spells.json dice/save-axis even when the name resolves (findMonsterSpell 5e→2024 fallback live for other lanes).

## Regression note
Popup "DC Unknown" cosmetic twin (DiceRollResult) recurs — same surface as MA-1546/§138; fix should thread row save_dc into result popup.
