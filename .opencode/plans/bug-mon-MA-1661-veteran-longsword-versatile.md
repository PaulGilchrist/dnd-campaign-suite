# BUG MA-1661 — Veteran / Longsword (actions[1]): versatile "or 8 (1d10 + 3) two hands" clause prose-only, chooser structurally inert

## Row (manifest MA-1661, stableKey veteran|actions|1)
Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage, or 8 (1d10 + 3) slashing damage if used with two hands.

## EXPECTED (RAW + §415 TWO-HANDED SLOT RULE)
"or 8 (1d10 + 3) slashing damage if used with two hands" is an ALTERNATIVE-die clause ("or", not additive "plus") → MUST be authored `damage_dice_two_handed:"1d10 + 3"`, arming the live HIT-popup two-handed chooser (MA-1063 byte-shape; twins: half-red-dragon-veteran Longsword — same +5/1d8 + 3/slashing row — and drider Longsword MA-0636 FIXED). GM pressing Longsword and hitting must get a "Two-Handed: 1d10 + 3 slashing / One-Handed: 1d8 + 3 slashing / Done" choice; picking two-handed flips the roll formula to "1d10 + 3" byte-exact.

## LIVE (2026-09-30, test-campaign, own DOM/curl truth)
- Disk: veteran actions[1] keys = `{name, description, attack_bonus, reach, damage_dice_primary, damage_type_primary}` ONLY — `damage_dice_two_handed` ABSENT. Description byte-exact incl. two-hands clause.
- Seam: buildTwoHandedVariantOffer (MonsterCardHelpers.js:992) arms chooser ONLY from `action.damage_dice_two_handed`; key absent → null (threaded MonsterCardModal.jsx:1222) — structurally inert, MA-1608 twin.
- Press ledger (3 real-pointer presses on Longsword-row "+5" chip, §693 row-scope vs Shortsword "+5" twin §694):
  - P1 nat8+5=13 vs AC12 HIT → popup buttons ["Done"] ONLY; damage formula "1d8 + 3" slashing, rolls[3] fd6, hp_change Δ−6 (999→993) breakdown slashing 6 unclamped.
  - P2 nat13+5=18 vs AC12 HIT → ["Done"] only; "1d8 + 3" rolls[5] fd8, Δ−8 (993→985).
  - P3 nat8+5=13 vs AC12 HIT → ["Done"] only; "1d8 + 3" rolls[3] fd6, Δ−6 (985→979).
- Two-hand affordance census: HIT-stage and damage-stage popup buttons == ["Done"] every press; overlay [role=switch]/radiogroup/tablist == 0; whole-log regex `/two.?handed/gi` == 0 hits; `/1d10/gi` == 0 hits; `variant_selected` == 0. ZERO GM choice, every hit pays 1d8 + 3 — prose-only inert FAIL(a).
- Σfd 20 == Σ|hpΔ| 20 exact; bonus +5, type slashing byte-exact on all legs; crit nat20 + miss faces unlanded in 3-press budget (§MA-1632 honest straddle, seams unobserved not defective). Console 0 errors.

## CLASSIFICATION: FAIL(a)/DATA
Prose-only versatile clause, structured field absent, chooser never arms — same family as MA-1608 (tribal-warrior Spear), MA-0325 siblings; Veteran named explicitly in playbook §166 prose-only family list.

## FIX (one field, Azer byte-shape placement — after damage_dice_primary, before damage_type_primary)
`public/data/monsters.json` veteran actions[1]:
```json
"damage_dice_two_handed": "1d10 + 3",
```
- "1d10 + 3" rides primary type (slashing); chooser swaps PRIMARY only (MA-0647/0652 behavior).
- No stale-pin inversion expected: MA-0286 suppression scan skips attack_bonus!=null rows (§397 precedent).
- Do NOT author damage_dice_secondary for this clause (§415: secondary = additive transport, would double-charge every hit — MA-0871 fingerprint).

## LEDGER
Bandit 1 (ac12, 999 rig) 999→979 (−6, −8, −6); Veteran 1 untouched 58/58; log 12 entries (3 join-noise + 3×(attack+damage+hp_change)); board admin-cleared post-test.
