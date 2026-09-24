# Bug MA-1100 — Lizard King/Queen "Trident": two-handed variant clause inert (missing damage_dice_two_handed)

## Overview
MA-1100 (lizard-king-queen|actions|3, Trident, attack) verifies the primary melee axis EXACTLY live, but the description's versatile clause "or 7 (1d8 + 3) piercing damage if used with two hands to make a melee attack" has NO authored transport field on disk, so no GM chooser ever appears on the HIT popup and 1d8 + 3 can never be dealt. Ranged clause is the documented §150/§193 inert-by-construction family. Per §290/§415/§437 precedent (kuo-toa Spear MA-1063, gnoll Spear MA-0871, drider Longsword MA-0636, half-ogre Battleaxe MA-0959 — all one-field fixes), variant-text inert without the authored field = FAIL(a)-DATA, not a PASS-subset note.

## Expected (verbatim description)
"Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 6 (1d6 + 3) piercing damage, or 7 (1d8 + 3) piercing damage if used with two hands to make a melee attack."

Expected: a HIT on this row offers the two-handed chooser ("Two-Handed: 1d8 + 3 Piercing?" — MA-0325/§166 seam, buildTwoHandedVariantOffer, MonsterCardHelpers.js:793) so the GM can adjudicate the versatile melee die.

## Actual
Disk row (public/data/monsters.json, lizard-king-queen actions[3]) EXACT:
{ "name": "Trident", "description": "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 6 (1d6 + 3) piercing damage, or 7 (1d8 + 3) piercing damage if used with two hands to make a melee attack.", "attack_bonus": 5, "reach": "5 ft.", "damage_dice_primary": "1d6 + 3", "damage_type_primary": "Piercing" }
- damage_dice_two_handed ABSENT → buildTwoHandedVariantOffer returns null (Helpers.js:794 `const variant = action?.damage_dice_two_handed; if (!variant …) return null`) → chooser never renders.
- damage_dice_ranged ABSENT and NO row-level `range` field ("20/60" lives in prose only; parseRangedBand reads row.range, Helpers.js:895) → rangedVariantRowArmed false, buildRangedVariantOffer null → ranged mode/chooser never arms (documented no-seam family §150/§193; band advisory also absent since it reads the same missing field).
- damage_dice_secondary ABSENT → NOT a §415 wrong-slot over-deal row; no additive misfire exists.
- Live (test-campaign, admin-fresh board, Bandit 1 AC12 maxHp999, target armed on Lizard own-card select): 3 real-pointer chip rolls, popup [role=switch]/[role=radiogroup]/[role=tablist] count 0, buttons ["Done"] only, no "two hands"/"ranged" text, popup OPEN audit ×3:
  1. nat7+5=12 ✓AC12 tie-boundary, formula "1d6 + 3" rolls[2] fd5, hpΔ −5 (999→994)
  2. nat7+5=12 ✓AC12, formula "1d6 + 3" rolls[1] fd4, hpΔ −4 (994→990) — distinct dice, honest replay ruled out (§77)
  3. nat20 CRIT, formula "1d6*2+3 (3)" rolls[3] fd9 (flat mod undoubled §32), hpΔ −9 (990→981)
  Every hit pays 1d6 + 3 only; 1d8 + 3 structurally unreachable. Zero console errors.

## Steps to Reproduce
1. localhost:5173 → test-campaign → Encounters → filter "Lizard King/Queen" → checkbox → Join; join "Bandit".
2. Full-store POST /api/campaigns/test-campaign/combatSummary with both NPCs maxHp/currentHp(+*HitPoints)=999; reload, re-select, arm Bandit 1 on Lizard King/Queen 1 initiative-card target-select.
3. Avatar → .mc-overlay → Trident row `.mc-dice-link` "+5" chip → real-pointer click.
4. On HIT popup observe: only "Done" button, zero toggles; Done pays "1d6 + 3" Piercing. Repeat ×3 — no two-handed chooser ever appears.

## Likely Location
DATA: public/data/monsters.json lizard-king-queen actions "Trident" — add one field `damage_dice_two_handed: "1d8 + 3"` (Azer Warhammer / MA-1063 kuo-toa Spear / MA-0959 half-ogre Battleaxe placement: after damage_dice_primary, before damage_type_primary). Consumer already live (MA-0325 chooser: buildTwoHandedVariantOffer → useLoggedDiceRollAttack.js:211/281 HIT-popup offer; unpicked Done defaults one-handed with one_handed_variant_selected log §397). Ranged band "20/60" has no seam app-wide (§150/§193) — leave prose, do not author damage_dice_ranged in this ticket's scope.

## Notes
- Primary melee axis (+5, 1d6 + 3 Piercing, reach 5 ft. gridless-lenient, rangeReason:null §149) EXACT on all 3 rolls including nat20 crit seam — this is a pure one-field DATA defect, no code gap.
- Precedent: §290 (MA-0871), §415 two-handed slot rule, §436 (MA-1063 one-field fix). §415 wrong-slot check negative here (no damage_dice_secondary).
- Board admin-cleared after verification (change-data + log), cs empties GET-verified.
