# BUG MA-0325 — Azer / Warhammer: advertised two-handed 1d10+3 variant can never surface (MV-7 inert clause)

## Overview
Row MA-0325 (Azer, monsterIndex azer, actions[0] "Warhammer", attack) advertises an alternative
two-handed damage option in its description: "Hit: 7 (1d8 + 3) bludgeoning damage, OR 8 (1d10 + 3)
bludgeoning damage if used with two hands..., PLUS 3 (1d6) fire damage." The app authors only the
one-handed dice and offers no chooser, so the advertised 1d10 option can never be selected or rolled
anywhere — the MV-7 / MA-0007 inert-conditional-clause pattern. Core one-handed leg is exact.

## Expected
Per the row text, the GM should be able to adjudicate the two-handed variant (1d10 + 3 bludgeoning
+ 1d6 fire) — e.g. a dice chooser in the hit popup (per MA-0007 fixed shape: data + GM-adjudicated
popup offer) or an authored variant field consumed by the damage path.

## Actual
- Disk: monsters.json azer actions[0] keys = name, description, attack_bonus(5 == "+5"), reach
  ("5 ft."), damage_dice_primary ("1d8 + 3" == row one-handed clause), damage_type_primary
  (bludgeoning), damage_dice_secondary ("1d6"), damage_type_secondary (fire). NO variant keys —
  no `damage_dice_two_handed`, no `variants`, nothing for the 1d10 option.
- Grep: `extractDamageDiceFromDescription` (src/components/encounter/MonsterCardModal.jsx:367) —
  `if (existingDamageDice) return existingDamageDice;` short-circuits on the authored
  damage_dice_primary, so the prose "(1d10 + 3)" clause is never parsed. No
  `damage_dice_two_handed`/`two_handed` producer anywhere in src (grep-zero).
- Live (test-campaign, header verified; EB exact "Azer" → Join "Azer 1"; armed target
  cs.targetName=HexWarlock curl-verified; victim runtime HP 73, computed AC9):
  - Warhammer row outerHTML: `<div class="mc-action"><strong>Warhammer.</strong>
    <span class="mc-dice-link">…+5</span><span>Melee Weapon Attack: …</span></div>` —
    ONE affordance (the "+5" attack chip). No second damage chip, no two-handed chooser.
  - Hit popup (×3 completed hits) offers ONLY "Advantage / Disadvantage / Done"
    (button.dice-roll-reroll-btn) — no 1d8-vs-1d10 selection ever.

## Steps to Reproduce
1. localhost:5173 → test-campaign (verify header) → Encounters → search "Azer" → exact row → Join.
2. Initiative: arm Azer 1 target = HexWarlock (AC9); open Azer card.
3. Dump Warhammer `.mc-action` outerHTML → single "+5" chip, no variant affordance.
4. Click "+5" → popup shows d20+5 vs AC9 with only adv/dis+Done (no dice chooser); Done →
   stage-2 receipt always "1d8 + 3 … Secondary Damage: 1d6 … fire". 1d10 never offered.

## Core leg — EXACT (recorded)
- Boundary vs AC9 (+5) exact: nat12→17 HIT, nat9→14 HIT, nat3→8 MISS (targetAc/effectiveAc 9 logged).
- All 3 completed hits: formula "1d8 + 3" bludgeoning + secondaryFormula "1d6" fire EVERY hit
  (fire unconditional, matches row text); totals 9+1=10, 11+3=14, 11+5=16; hp_change deltas
  −10/−14/−16 (73→63→49→33); total == finalDamage+secondaryFinalDamage == |hpΔ| each hit.
- MISS → zero damage rolls, zero hp_change. Crit nat20 not exercised (no nat20 in 5 rolls) —
  secondary-doubling shape untested; not needed for verdict.
- One consumed roll (nat6/14 first attempt) logged hit with no damage — GM skipped Done on a
  popup absorbed by MV-2 stage-intercept; rig artifact, not row defect.

## Verdict basis
MV-7 precedent (docs/test-setup-playbook.md:296, MA-0007): an advertised alternative-damage clause
with NO data field, NO consumer (grep-zero + short-circuit), and live zero-offer (no chooser in row
or popup) = FAIL flavor(b). The two-handed 1d10+3 is precisely such an advertised option — it is the
row's differentiator vs a plain 1d8 weapon and can never surface. Core one-handed + fire leg is exact.

## Fix direction
MA-0007 fixed shape: author the variant in data (e.g. `damage_dice_two_handed: "1d10 + 3"` or a
`variants` list) and surface a GM-adjudicated chooser chip/radio in the hit popup; or strip the
clause from the description so the row does not advertise unimplementable options.

## Cleanup
Admin Clear Change Data + Clear Campaign Log (native confirms named "test-campaign") →
change-data `{}`, log `[]` curl-verified.
