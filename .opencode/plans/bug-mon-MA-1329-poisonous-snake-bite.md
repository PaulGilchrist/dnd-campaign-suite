# BUG MA-1329 — Poisonous Snake "Bite" (attack+save composite): attack leg pays save dice

**VERDICT: FAIL (a)** — attack-leg damage wrong: flat 1 Piercing silently dropped AND the save-gated
2d4 Poison is paid FULL as direct attack-hit damage (no save adjudication on the +5 chip).
Save leg (DC chip) is correct in isolation.

## Expected (row, public/data/monsters.json "poisonous-snake")
> "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: **1 piercing damage**, and the target
> must make a **DC 10 Constitution** saving throw, taking **5 (2d4) poison** damage on a failed save,
> or half as much damage on a successful one."

Disk fields: `attack_bonus:5, damage_dice_primary:"2d4", damage_type_primary:"Poison", save_dc:10,
save_type:"Constitution"`. The flat 1 Piercing has NO authored field; `damage_dice_primary:"2d4"` is the
SAVE-leg poison. Expected total on hit+fail: 1 Piercing + 2d4 Poison. On hit+save: 1 Piercing + half 2d4.

## Actual (live, test-campaign, Bandit 1 AC12 CONsave+0, HP rigged 200)
- Attack chip `+5` ×4: MISS(7), **HIT(16)**, MISS(8), MISS(8).
- On the hit, app auto-rolled `roll damage "2d4" → [1,4]=5, damageType Poison, note:"combined_damage_roll"`,
  `hp_change −5` (200→195), **no save prompt**, **zero Piercing entries anywhere in the log**.
- Save chip `DC 10 Constitution` ×2:
  - d20 19 vs DC 10 CON → SUCCESS → `save-damage 2d4 [3,3]=6 → finalDamage 3` (exact half), HP 195→192 ✓
  - d20 9 vs DC 10 CON → FAILURE → `save-damage 2d4 [1,3]=4 → finalDamage 4` (full), HP 192→188 ✓
- Total dealt by snake: 5 + 3 + 4 = 12 = 2d4(hit) + half2d4 + 2d4 — RAW would be 1 + (half|full)2d4 per bite.
  The flat 1 Piercing is never dealt on ANY hit; the poison pool is dealt un-gated on the attack leg too.

## Root cause (grep)
- `MonsterCardModal.jsx:685-690` `extractDamageDiceFromDescription(description, existingDamageDice)`:
  `if (existingDamageDice) return existingDamageDice;` → row's `damage_dice_primary:"2d4"` (the SAVE dice)
  short-circuits FIRST.
- `MonsterCardModal.jsx:859` `buildAutoDamageOptions`: `baseFormula = extractDamageDiceFromDescription(...)
  || extractFlatHitDamage(action)` → baseFormula = **"2d4" Poison**; `extractFlatHitDamage`
  (`MonsterCardHelpers.js:2379`, MA-0322/MA-0747 lineage) WOULD extract "1" from the Hit: clause — it is
  unreachable for this row because the primary dice already won.
- MA-0551 composite fork `isCompositeAttackSaveRow` (:919) + `buildAttackChipSaveOptions` (:981-989):
  attack chip nulls `saveDc/saveType/dcSuccess` → damage lands via plainDamageHandler at FULL value
  (`useLoggedDiceRollDamage.js:139-151`) = **combined_damage_roll 2d4 on the attack hit**.
- Save leg: `saveChipPlan` (:967) formula "2d4" rollable → `saveProcessing` half-on-success correct
  (`dcSuccess:'half'` default, log `saveSuccess` face + exact half confirmed live).
- Byte-twins prove the engine handles correct authoring: Giant Poisonous Snake authors
  `damage_dice_primary:"1d4 + 4" Piercing + damage_dice_secondary:"3d6" Poison` (correct split, MA-0551
  `saveLegCarriesSecondaryDamage` routes secondary to the save chip); MA-0885 Goat Ram shows flat
  `damage_dice_primary:"1"` is representable (resolved dice-less via parseConstant).

## Likely DATA vs code
**DATA.** The row routes the save poison dice into `damage_dice_primary` and omits the flat 1 Piercing;
the engine generically treats `damage_dice_primary` as the attack-chip auto-damage. Suggested fix mirrors
the Giant Poisonous Snake / MA-0885 twins:
`damage_dice_primary:"1", damage_type_primary:"Piercing", damage_dice_secondary:"2d4",
damage_type_secondary:"Poison"` (save_effect unchanged) → attack chip pays flat 1, save chip adjudicates
secondary 2d4 full/half.

## Machine keys / registry
- §508 verified: `cs.creatures["Poisonous Snake 1"].targetName === "Bandit 1"` after own-card
  `[data-testid="target-select"]` selectOption.
- `saveResult-Bandit 1` change-data key NOT created for NPC targets; verdicts live in attacker store
  `Poisonous Snake 1.lastSaveRoll` / `_lastRollContext` + log `roll.save.saveResult:"success|failure"`.
- Save modifier displayed +0 for Bandit (CON 12, cs `saveBonuses.con:1`) — cosmetic note only.
