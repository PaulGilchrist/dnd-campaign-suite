# Bug CLA-120 — Empowered Evocation: INT modifier added TWICE per damage roll (duplicate folds + per-target AoE fold)

## Title
Empowered Evocation (Evoker): the +INT term is appended by two independent folds on single-target attacks (formula shows `+ 5 [Empowered Evocation] + 5 [Empowered Evocation]`) and folded once PER TARGET on AoE saves — RAW grants it on ONE damage roll only.

## Overview
Verified 2026-10-04, test-campaign, host DivinationWizard lv20 (INT +5) temporarily swapped subclass to Evoker (reverted; disk `subclass: Diviner` GET-verified), victims "+NPC" proxies.

## Expected Behavior
Whenever you cast a Wizard Evocation spell, add your Intelligence modifier to ONE damage roll of that spell (once per spell — not twice, not per target).

## Actual Behavior
1. Fire Bolt hit 24 vs AC10: log `4d10 + 5 [Empowered Evocation] + 5 [Empowered Evocation]` rolls [8,10,6,4] total 38, mod 10 — INT ×2 (should be 28+5=33).
2. Fireball DC19, 2 targets: app rolls SEPARATELY per target and folds INT into EACH — NPC3 `8d6 +5 [EE]` 25+5=30, NPC4 `8d6 +5 [EE]` 28+5=33 → INT twice in one cast; RAW one damage roll.
3. PASS controls: Poison Spray (necro) `4d12 [poison] mod 0` — school gate live (`spell.school==='evocation'`, damageCalculation.js:35-41); label `[Empowered Evocation]`; cantrip+leveled eligibility correct; magnitude wrong.
4. Potent-Cantrip miss path double-labeled too: `cantrip-miss-half-damage 4d10 + 5 [EE] + 5 [EE]` (phantom roll, mod 0).

## Root cause (shape)
- Single-target: attackPostProcessing.js:427 pre-bakes formula WITH the bonus; attackRollDamageCalc.js:64-66 appends the same term again → duplicate.
- AoE: savePath.js resolveAoeDamageInfo folds INT once per per-target roll (should pick one roll only).

## Steps to Reproduce
1. test-campaign; Evoker wizard lv20; arm initiative-card `.creature-target select` on proxy before casting (un-armed cast = phantom targetName:null log).
2. Cast Fire Bolt → ledger shows two `[Empowered Evocation]` terms.
3. Cast Fireball on 2 NPCs → each per-target roll carries +INT.

## Likely Location
- attackRollDamageCalc.js:64-66 — drop append when attackPostProcessing.js:427 already baked it (single owner of the fold).
- savePath.js resolveAoeDamageInfo — add INT to ONE roll per cast (first target or chosen), zero on the rest.

## Notes
- 2024 subclass option string is "Evoker" (not "School of Evocation"). Soulstitch Spells modal pops on first Fireball — Cancel. AoE `.sp-roll-btn` offscreen — evaluate el.click(). Host reverted (Diviner), spells unchanged (53), Admin Full Reset, change-data/log GET-empty. Verified 2026-10-04.
