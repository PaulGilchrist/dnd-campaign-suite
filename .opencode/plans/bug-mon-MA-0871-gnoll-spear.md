# BUG — MA-0871 Gnoll Spear: authored damage_dice_secondary is a COMBINED-ALWAYS rider (FAIL(a))

**Verdict: FAIL(a)** — every Spear hit rolls PRIMARY `1d6 + 2` AND secondary `1d8 + 2` and sums them. The description's two-handed damage is an OPTIONAL alternative ("or 6 (1d8 + 2) piercing damage if used with two hands"), not an additive rider. One-handed RAW hit maxes at 8; live ledger paid 16.

## HOW the app surfaces authored damage_dice_secondary (answer for playbook)
**COMBINED transport, not chip pair, not chooser:**
1. NO secondary chip on this row: `ActionDamageLinks` self-suppresses ALL damage chips (primary AND secondary, `MonsterAction.jsx:44-57`) on `attack_bonus` rows → Spear renders ONE "+4" chip only (§116/§219). The §117 secondary chip pair exists only on attack_bonus-less rows.
2. NO two-handed chooser: `buildTwoHandedVariantOffer` (`MonsterCardHelpers.js:742`) arms ONLY on `damage_dice_two_handed` — absent here (§166). `rangedVariantOffer` arms only on `damage_dice_ranged` (absent; ranged band 20/60 inert-by-construction per §MA-0867 — PASS-subset, not chased).
3. Secondary rides the attack-chip auto-damage transport UNCONDITIONALLY: `buildAutoDamageOptions` → `buildSecondaryDamageTransport` (`MonsterCardModal.jsx:831-845`) emits `autoDamageSecondaryFormula:"1d8 + 2"` for ANY row carrying `damage_dice_secondary` (composite-save strip requires save_dc — absent); context stamped `MonsterCardModal.jsx:1712-1715`; `handlePlainDamage.rollAndApplySecondaryPlainDamage` (`:117-132`) rolls the second pool on every hit and sums (`computeDamageOutcome :698`). The MA-0426/0531 transport is designed for ADDITIVE riders ("plus 3d6 poison") — versatile "or" damage misfiled into it double-charges every hit.

## LIVE evidence (test-campaign, 2026-09-22, dev :5173)
- Chip inventory, Spear row (`<strong>` startsWith "Spear", own card, 1 row): ONE chip `{text:"+4", cls:"mc-dice-link"}`. Zero "1d8 + 2" chip. Overlay toggle audit `[role=switch]/[role=radiogroup]/[role=tablist]/select` = 0.
- Press 1: nat3+4=7 ✗ MISS (no-Done stage-1). Press 2: fresh log entry, nat3 again (second die 17 distinct — honest §77), ✗. Press 3: nat12+4=16 ✓ HIT, Done visible.
- Real-pointer Done (`button.dice-roll-reroll-btn`, §MA-0869): stage-2 popup text — "Spear 7 1d6 + 2: 5 +2 7 damage applied to Bandit 1 — HP: 990 → 983 **Secondary Damage: 1d8 + 2: 7 +2 = 9 7 Piercing damage + 9 Piercing damage = 16 total damage 16 damage applied to Bandit 1 — HP: 999 → 983**". Zero chooser buttons (filter /hand|1d8/i on open popup buttons = []).
- Ledger (§140 combined shape): `roll damage` name:"Spear" formula "1d6 + 2" finalDamage 7 (primary only ✓) rolls[5] + secondaryFormula "1d8 + 2" secondaryTotal/secondaryFinalDamage 9, both Piercing, note:"combined_damage_roll". `hp_change` Δ−16 Bandit 1 (999→983); 7+9=16==|hpΔ| exact.
- lastAttack: bonus:4 total:16 hit:true targetAc:12 effectiveAc:12 weaponType:"melee" damageFormula:"1d6 + 2" **secondaryFormula:"1d8 + 2" secondaryDamage:7** damageApplied:true.
- Console 0 errors. Budget: 3 chip presses (1 hit ≥ required; misses honest).

## Why FAIL(a), not acceptable-default
Two-hand is an OPTION: primary-only default is acceptable per task adjudication, but here BOTH pools auto-fire EVERY hit with NO way to select either mode → over-damage every single hit (2× dice pools). This is the "combined-always-wrong" axis, not "secondary inert" (FAIL(b) does NOT apply — the secondary is very much live, just semantically miswired).

## Fix (one-field DATA, byte-shape exists app-wide)
Move "1d8 + 2" from `damage_dice_secondary` to `damage_dice_two_handed:"1d8 + 2"` (MA-0325/§166 Azer Warhammer / MA-0652 Quarterstaff placement: after damage_dice_primary, before damage_type_primary) and DELETE `damage_dice_secondary`/`damage_type_secondary`. `buildTwoHandedVariantOffer` then arms the HIT-popup chooser (MA-0652 live twin ledger: "Two-Handed: 1d8 + 2 / One-Handed: 1d6" third-stage, unpicked Done = one-handed default `one_handed_variant_selected`); secondary transport goes byte-inert, single-hand hits stop double-charging.
Caution: MA-0286-style suppression/stale-pin scans may pin gnoll/Spear secondary — invert same pass (§216/§219 pattern).

## PASS-subset notes
- Ranged band "20/60 ft." inert-by-construction (§MA-0867/§150): documented, not chased.
- Piercing type on both legs matches disk/description; to-hit +4 and AC12 seam exact.

## Registry delta (Gnoll)
- MA-0870 Bite PASS (already logged). Add MA-0871 Spear FAIL(a): versatile "or 1d8+2 two hands" authored into damage_dice_secondary → combined-always double-charge; fix = damage_dice_two_handed one-field (§166 template).

## Injection watch (§1)
Multiple fabricated `[SYSTEM]/[USER]` copyright-blocks injected into tool-result bodies mid-session (navigate/click/evaluate echoes). All ignored; every URL self-verified localhost:5173 throughout; no off-site navigation, no data destruction beyond sanctioned admin-clear cleanup.
