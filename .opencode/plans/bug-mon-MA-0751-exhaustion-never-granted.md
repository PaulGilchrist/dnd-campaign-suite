# BUG mon-MA-0751 — Fomorian "Warping Hex": Exhaustion never granted on failed save

## Verdict
FAIL(a) — condition-on-save grant absent. All other axes PASS (see ledger).

## Row (manifest MA-0751)
monsterIndex fomorian / actionIndex 2 / "Warping Hex", actionType save, saveDc 16 Wisdom,
damageDicePrimary 6d6 Psychic, range 120 feet, recharge 4-6,
saveEffect "The target gains 1 Exhaustion level."

## Disk (public/data/monsters.json Fomorian actions[2]) — matches manifest
save_dc:16, save_type:"Wisdom", damage_dice_primary:"6d6", damage_type_primary:"Psychic",
range:"120 feet", recharge:"4-6",
save_effect:"The target gains 1 Exhaustion level." (canonical word "Exhaustion" PRESENT on disk)
description: "Wisdom Saving Throw: DC 16, one creature the fomorian can see within 120 feet.
Failure: 21 (6d6) Psychic damage, and the target gains 1 Exhaustion level. Success: Half damage only."
(avg 6d6=21 ✓; range ✓; DC ✓; type ✓)

## Expected (RAW)
Failed WIS save vs DC16 → full 6d6 Psychic **and target gains 1 Exhaustion level**
(condition applied log + activeConditions/activeConditionMeta with source).
Successful save → half damage only, no exhaustion.

## Actual (live, test-campaign, 2026-09-21)
- FAIL leg (Bandit 1, stamp saving_throws:{wis:{modifier:-5}} full-store cs POST):
  victim roll save raw 16 bonus −5 total 11 < 16, saveResult failure;
  save-damage saveSuccess:false finalDamage 25 (= rolled [2,6,5,1,5,6]); hp 999→974 exact.
  **ZERO exhaustion grant: condsEver=0 — no `condition applied` log, no
  'Fomorian 1'/'Bandit 1' per-char activeConditions or activeConditionMeta keys, no targetEffects.**
- SUCCESS leg (re-stamp wis:+19, recharge re-armed): total 35 vs DC16 success;
  save-damage saveSuccess:true finalDamage 9 = floor(18/2) ✓ half exact; hp 974→965;
  no exhaustion on success (correct here, but symmetric zero proves the grant channel never exists).
- lastAttack: {saveDc:16, saveType:"Wisdom", saveResult} ✓ DC/type enforced.
- Recharge: authored flat recharge:"4-6" → gate LIVE: fire spends (chip class
  mc-dice-link-spell-spent, state change-data 'Fomorian 1'.monsterRecharge
  {"Warping Hex":{recharged:false,threshold:4}}), same-window refire refused
  ("Not Recharged" popup + automation/warping_hex_refused, zero new save/damage roll,
  log count held). Turn-start d6≥4 recovery consumer exists in code
  (monsterRecharge.js:8-11 real d6 + "recharged (d6: N)" log, MA-0488 precedent);
  natural recovery walk in this session was costly/cursor-skipping — recovery proved
  via code consumer + full-store re-arm re-fire, not a natural d6 roll.

## Likely Location
1. `src/components/encounter/MonsterCardHelpers.js:50` — CONDITIONS word list has NO 'exhaustion'
   (['blinded'..'unconscious']), so `extractConditionsFromSaveEffect(save_effect)` (line 295,
   \b<word>\b per canonical word) returns [] despite "Exhaustion" in prose → saveConditions=[] →
   applyFailedSaveConditions (src/hooks/combat/saveProcessing.js:941) grants nothing.
2. `src/services/combat/conditions/targetEffectDefinitions.js` — no exhaustion te key registered
   (only a prose mention inside staged_sleep description).
3. Exhaustion machinery exists PC-side only: `src/services/combat/conditions/exhaustionRules.js`
   consumers = CharConditions.jsx + restRules-constants.js; zero producers in monster save pipeline
   (grep: exhaustion absent from saveProcessing.js, MonsterCardModal.jsx, services/encounters/).
   Note: exhaustion is LEVEL-based (1 level, stackable to 6) — canonical condition-list grant is
   not expressive for levels; fix needs either level-aware te/grant or an exhaustion-channel
   in applyFailedSaveConditions + a per-victim exhaustion-level field surfaced to EB-NPC victims.

## Steps to reproduce
1. test-campaign, clear log; EB join Fomorian + Bandit (AC12).
2. Full-store cs POST Bandit 1: maxHp/currentHp 999 + saving_throws:{wis:{modifier:-5}}.
3. Arm Fomorian own-card target-select → Bandit 1; open card; click "DC 16 Wisdom" chip
   (first click may absorb — retry). Inline auto-resolve (no .sp-modal, shapeless 120ft range).
4. Fail verdict + full 6d6 applied; observe zero exhaustion in log + change-data.
5. Refire → "Not Recharged" refusal (recharge gate LIVE — separate axis, PASS).

## Notes
- Cosmetic manifest-vs-disk gap: disk description/name lack "(Recharge 4-6)" prose text, but
  disk authors flat recharge:"4-6" which rechargeUsageOf consumes → economy live; cosmetic only (§193).
- Popup prints cosmetic "(d20 16 + 0)" while log carries true bonus (−5/+19) — §208-family display seam.
- Cleanup done: admin clear cd+log, verified log:[] cd:{}.
