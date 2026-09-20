# BUG MA-0636 — Drider "Longsword" (actions[2], attack +6, reach 5 ft.) — FAIL(a): VERSATILE SECOND FORMULA UNREACHABLE (unauthored `damage_dice_two_handed`)

## Overview
Row prose carries a RAW versatile clause — "Hit: 7 (1d8 + 3) slashing damage, **or 8 (1d10 + 3) slashing damage if used with two hands**" — but disk authors only `damage_dice_primary: "1d8 + 3"`. No `damage_dice_two_handed` field, no toggle, no chooser: the two-hands formula `1d10 + 3` is unreachable in live adjudication. Unlike the §147 zero-seam dual-mode family, the consumer seam HERE EXISTS AND IS LIVE (MA-0325 two-handed offer) — this row simply lacks the one authored field that arms it. Primary formula itself is exact.

## Expected Behavior (row)
- description verbatim: "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage, or 8 (1d10 + 3) slashing damage if used with two hands."
- On a HIT, the popup should offer the GM a two-handed damage choice (`1d8 + 3` default vs `1d10 + 3`) per the MA-0325 template (Azer Warhammer precedent: `damage_dice_two_handed: "1d10 + 3"` authored → HIT-popup offer swaps Done auto-damage formula).

## Actual Behavior (live, test-campaign, EB join exact "Drider" + Bandit qty1 staged 999 HP, armed via Drider's own initiative-card target-select)
- 3 chip clicks on the " +6" Longsword chip; 3 resolved hits (1 absorbed first click per §138 chip fingerprint), 2+ Done applied:
  - ATK nat12 +6 = 18 vs AC12 ✓ HIT → DMG formula "1d8 + 3" final 5 slashing → hp_change −5 (== |finalDamage|).
  - ATK nat11 +6 = 17 vs AC12 ✓ HIT → "1d8 + 3" final 9 slashing → −9.
  - ATK nat6 +6 = 12 vs AC12 ✓ HIT (exact AC boundary) → "1d8 + 3" final 8 slashing → −8.
- Primary formula, bonus, AC, damage type, hp deltas: all exact.
- **Zero-swap proof**: whole-overlay audit `.mc-overlay`: `[role=switch]`=0, `[role=radiogroup]`=0, `[role=tablist]`=0, radio/checkbox inputs=0; popup stage likewise 0 mode toggles; "two hands" appears in overlay only inside the prose description, never as an affordance. Every roll consumed `1d8 + 3`; no roll could ever surface `1d10 + 3`.
- Miss corroboration (§75/§118): +6 vs AC12 misses only on nat≤5; 3/3 rolls hit including the exact nat6=AC12 contact — boundary adjudication honest; no dedicated miss obtained within loop budget (not structurally required; contact proof recorded instead).

## Grep Evidence
- `rg "versatile|two.?hands" src/` (non-test): consumers = PC race trait/feat validation, Great Weapon Fighting core rule, Versatile Trickster rogue handler — NONE touch monster damage dice.
- Monster-side seam: `buildTwoHandedVariantOffer` (MonsterCardHelpers.js:687) keys SOLELY on `action.damage_dice_two_handed` (returns null when absent — byte-inert); wired live at MonsterCardModal.jsx:849 (`twoHandedVariantOffer`) + `useLoggedDiceRollAttack.js:258` (HIT popup only) + `DiceRollResult.jsx:865`.
- Disk twins with the field authored: **Azer Warhammer `damage_dice_two_handed: "1d10 + 3"`** (MA-0325 fixed template). 17 other versatile-prose rows (incl. this Drider, Veteran, Hobgoblin, Half-Red Dragon Veteran Longswords; spear staff trident family) lack it — same defect family, same one-field fix.

## Likely Location / Fix
- **DATA (one field)**: add `"damage_dice_two_handed": "1d10 + 3"` to Drider Longsword row (`public/data/monsters.json`, actions[2]). Consumer is live; row is unauthored ⇒ inert. No code change needed.
- Alternative reading (documented): accept the versatile clause as advisory GM choice per §69/§70 advisory ceilings. REJECTED per MA-0325 precedent: §147/§105 treat zero-swap rows as construction-inert FAIL, and here the sanctioned chooser seam already exists — calling it "advisory" when a one-field authored fix makes it live contradicts the Azer precedent. Trichotomy ⇒ **FAIL(a)**.
- Note §529 distinction: MA-0529 keys dual-mode failures on the range band; this row is the melee-versatile family (MA-0325), where the arm-key is `damage_dice_two_handed`.

## Notes
- Register the fix in the same sweep as the other 17 unauthored versatile rows (all byte-shape identical fix).
- Log schema reminder: monster attack logs key `name:"Longsword"` with `rollType` attack/damage (§144); damage entries carry `note:"combined_damage_roll"`, no `secondaryFormula` field on this row (correctly absent — secondary seam belongs to Bite/Longbow rows).
