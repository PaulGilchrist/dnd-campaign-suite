# BUG MA-0794 — Giant Boar Gore: Prone rider never granted (FAIL(a)/DATA, one-field)

**Row:** giant-boar|actions|0 "Gore" (+5, reach 5 ft., 2d6+3 Piercing; charge rider: +2d6 Piercing + Prone when moved 20+ ft straight).
**Verdict:** FAIL(a)/DATA — condition axis standalone. Damage axis PASS-subset (§531-sanctioned ungated combined transport). Console 0 errors.

## Disk (public/data/monsters.json giant-boar actions[0], quoted FULL)
Keys authored: `attack_bonus:5`, `damage_dice_primary:"2d6 + 3"`, `damage_type_primary:"Piercing"`, `damage_dice_secondary:"2d6"`, `damage_type_secondary:"Piercing"`, `reach:"5 ft."`, `name`, `description`.
- `damage_dice_secondary:"2d6"` **AUTHORED** → rides PRIMARY every hit via buildSecondaryDamageTransport (MonsterCardModal.jsx:831) → autoDamageSecondaryFormula on attack chip; non-composite row (no save_dc, isCompositeAttackSaveRow:false :856) so secondary never nulled (:911 branch not taken).
- `conditional_damage` **ABSENT** → ChargeBonusOffer (MA-0007 chooser) never arms → charge gate unmodellable gridless §42; extra-2d6 paid every hit = §114/§531 accepted transport (note: semantics differ from RAW charge-gated rider; adjudicated sanctioned, not FAIL — damage numbers exact).
- `hit_conditions` **ABSENT** → buildHitConditionClause reads `action.hit_conditions` only (§150, handlePlainDamage consumer live) → Prone NEVER granted. Manifest `conditions:["prone"]` prose label never lands (§150/MA-0291/0361 family).

## Live proof (test-campaign, header verified; Bandit 1 AC12 maxHp999, Giant Boar 1 armed)
- Stage-1 popup audit ×4 (§65): HIT popups buttons = `["Done"]` ONLY (zero ChargeBonusOffer); MISS popups buttons `[]` (Done-less §94).
- Ledger, 2 hits: nat11+5=16✓ → formula `2d6 + 3` dice[6,1] fd10 + secondaryFormula `2d6` secRolls[5,1] secFd6, note `combined_damage_roll` on PRIMARY entry §531/§140; hp_change Δ−16 = 10+6 breakdown Piercing10+Piercing6 exact (§181 unclamped). nat8+5=13✓ → fd13 rolls[4,6] + secFd6 [5,1]; Δ−19 = 13+6 exact. Distinct primary dice kill §77 replay suspicion; secondary [5,1] repeat = honest 2d6 coincidence (distinct totals+nat per entry).
- Misses ×2 (nat2→7✗, nat3→8✗ vs AC12): zero damage entries, zero hp_change ✓.
- Prone: ZERO `condition applied` entries, victim cs.conditions never carries prone, change-data top-level targetEffects empty → rider dead standalone.

## Fix (one field, MA-0621/0763 byte-shape)
Add `hit_conditions:["prone"]` to giant-boar actions[0]. buildHitConditionClause arms; handlePlainDamage grants incl. Large-or-smaller gate (§150). charge-extra stays as authored damage_dice_secondary (§531 transport; conditional_damage/ChargeBonusOffer NOT required for this row's pass — gate unmodellable gridless §42). Verify post-fix: hit → `condition applied` Prone + badge; miss zero.

## Registry/cleanup
Board admin-cleared pre+post session (log:[] cd:{} verified). test-campaign only. No manifest/git writes.
