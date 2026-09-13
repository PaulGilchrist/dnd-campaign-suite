# Bug MA-0045 — Adult Blue Dracolich Bite: lightning bonus clause inert + data typo "1dlO"

## Verdict: FAIL (strict) — core bite dice exact, but the named "plus lightning" bonus is unmodelled and unrolled; row damage is short by +5 (1d10) lightning per RAW.

## Expected
Row: "Melee Weapon Attack: +13 to hit, reach 10 ft., one target. Hit: 18 (2d10 + 7) piercing damage plus 5 (1dlO) lightning damage."
- To-hit d20+13 vs target AC; damage `2d10 + 7` piercing PLUS a lightning secondary (`1d10` / flat 5).

## Actual
- To-hit EXACT: d20 7 +13 = 20 vs AC 19 → HIT (attempt 1/2).
- Damage: `2d10 + 7` [6,7]+7 = **20 piercing only** → ElderPaladin 224→204. change-data lastAttack: `{attackName:"Bite", total:20, targetAc:19, hit:true, damageFormula:"2d10 + 7", rolls:[6,7], actualDamage:20, damageType:"piercing", damageApplied:true, affectedTargets:["ElderPaladin"]}`.
- Lightning CHECK: **ZERO lightning dice rolled** anywhere in UI, log, or change-data (no `damage_*_secondary*` keys exist; lightning strings in change-data are immunity text/description echoes only). Log has only one roll (d20 7+13) + one damage (2d10+7 piercing) entry.

## Root cause — data drift, description-only
public/data/monsters.json · Adult Blue Dracolich · Bite authors ONLY:
`attack_bonus:13`, `reach:"10 ft."`, `damage_dice_primary:"2d10 + 7"`, `damage_type_primary:"piercing"`.
- **NO `damage_dice_secondary` / `damage_type_secondary`** → the roll link has no structured secondary to roll; the "plus 5 (…) lightning damage" clause is description-only → structurally inert.
- **Typo CONFIRMED in data:** description reads `plus 5 (1dlO) lightning damage` — letter "O" instead of digit "0" ("1dlO"). Same OCR-style corruption in Lightning Breath `66 (12dl0)` (its save_effect field spells `12d10` correctly, proving the corruption site). Even if a parser were added to extract description-only secondaries, the `1dlO` typo would defeat a `[0-9]+d[0-9]+` regex match.

## Repro
1. test-campaign (MV-18) → Encounters → tick "Adult Blue Dracolich" → Join Encounter (init card 225/225, init 12).
2. `.creature-card.npc` target select → ElderPaladin (AC 19, HP 224 armed/non-zero, MV-19/22).
3. Avatar → monster card modal → Bite "+13" → d20 7 = 20 vs AC 19 HIT → Done → damage panel "2d10 + 7: 6, 7 +7" → "20 damage applied to ElderPaladin — HP: 224 → 204". No lightning dice, no secondary panel.

## Likely Location
- `public/data/monsters.json` (Adult Blue Dracolich → actions → Bite): missing `damage_dice_secondary:"1d10"` / `damage_type_secondary:"lightning"` + "1dlO" typo.
- Consumer: MonsterAction/monster-card-modal damage pipeline rolls `damage_dice_primary` only; no description-text fallback exists for inline "plus N (XdY) <type>" bonuses.

## Verdict
FAIL — to-hit (+13) and primary formula `2d10 + 7` piercing are exact and live, but the row's named lightning bonus (+5 (1d10) lightning) never rolls: no structured secondary authored (inert by data) AND the authored description contains the typo "1dlO" (letter O). Damage short by 5–15 lightning per RAW bite.
