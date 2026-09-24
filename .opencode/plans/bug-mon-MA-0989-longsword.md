# MA-0989 — Hobgoblin "Longsword" (attack) — VERIFIED: FAIL(a)

Date: 2026-09-23 · Campaign: test-campaign (header-verified) · Dev: :5173 REUSE (curl 200)

## Row (manifest, do-not-edit)
attackBonus 3 | primary "1d8 + 1" Slashing | reach 5 ft.
Description: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) slashing damage, or 6 (1d10 + 1) slashing damage if used with two hands."

## Expected (row clause + canonical)
Two-hands clause: "or 6 (1d10 + 1) slashing damage if used with two hands." Canonical versatile longsword (PHB 5e): one-handed 1d8+1, two-handed 1d10+1. Live seam per playbook §166: `action.damage_dice_two_handed` → `buildTwoHandedVariantOffer` (MonsterCardHelpers.js:767) → HIT-popup two-handed chooser (useLoggedDiceRollAttack.js:258/281; MonsterCardModal.jsx:1059). Twin precedent: Azer Warhammer authored.

## Actual (core pass, variant inert)
- Disk: Hobgoblin Longsword keys = [name, description, attack_bonus, reach, damage_dice_primary, damage_type_primary] — NO `damage_dice_two_handed` (grep: 5 occurrences app-wide, 0 within Hobgoblin blob).
- Arm-site: `buildTwoHandedVariantOffer` returns null on field-absent row (Helpers :768-770 `if (!variant ...) return null`) → offer null → no chooser.
- Live rig: EB exact "Hobgoblin" checkbox → Join → cs idx 20 "Hobgoblin 1" ✓; card fresh-opened via avatar; Bandit 1 (AC12, 430/999) armed on OWN-card `[data-testid=target-select]` (selVal "Bandit 1").
- 4 presses on Longsword "+3" chip:
  - P1: total 17 +3 HIT vs AC12 — damage "1d8 + 1: [4]+1"=5, fd 5 == |hpΔ| 430→425, breakdown Slashing resisted:false.
  - P2: nat20 CRIT "1d8*2+1 (2)"=5, fd 5 == |hpΔ| 425→420 (dice doubled, flat +1 not doubled — §32 exact).
  - P3: total 18 HIT — "1d8 + 1: [2]+1"=3, fd 3 == |hpΔ| 420→417, resisted:false.
  - P4: nat5 total 8 ✗ MISS vs AC12 — zero damage, zero hp_change.
- Boundary: monotonic confirmed (totals 17/18/23 all HIT, total 8 MISS vs AC12); exact nat9=12 boundary not rolled within budget 4 — no violation observed.
- Chooser audit: `[role=switch]/[role=radiogroup]/[role=tablist]` = 0 on stage-1, stage-2, post-Done — NO two-handed buttons ever appear (zero surprise).
- Log: exactly 3 entries/press (attack+damage+hp_change), 1 on miss; bonus:3 separate from raw total on every attack entry; targetAc==effectiveAc==12 everywhere; lastAttack hit:false tAc==effAc==12 formula "1d8 + 1".
- Console errors: 0. Stage-2 flushed via own click; popups=0; card open at end.

## Verdict
**FAIL(a)-DATA** — one-handed core exact + two-hands clause inert (field-absent, byte-inert chooser, audit zero). Same shape as MA-0959 Battleaxe precedent. Known sibling per playbook §166: "~17 sibling versatile rows Veteran/Hobgoblin same family, one-field fix."

## Fix (data, one field — orchestrator/GM owns monsters.json)
Hobgoblin Longsword action += `"damage_dice_two_handed": "1d10 + 1"` (per MA-0636/0652/0647/0959 family template; MA-0325 live-seam).

## Cleanup
Rig intact: Bandit 1 417/999 (drift −13 = 5+5+3 accounted), Hobgoblin 1 11/11, no clears, manifest untouched, no git writes.
