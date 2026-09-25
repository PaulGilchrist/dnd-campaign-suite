# Bug — MA-1147 Merfolk Skirmisher "Ocean Spear": Speed−10 hit rider inert (FAIL(a)/DATA)

## Title
MA-1147 Ocean Spear — "Speed decreases by 10 feet until the end of its next turn" hit rider never applied (unauthored `hit_target_effect`), numeric attack/damage half exact.

## Overview
Verified 2026-09-24 (test-campaign, Playwright E2E + source grep). The Ocean Spear attack resolves exactly (to-hit, primary + secondary damage, hp deltas), but the automatic Speed−10 rider described in the row has zero effect. A live transport seam exists (`hit_target_effect` passthrough) and identical-wording twins author it (MA-0995 Javelin, MA-1012 Ice Spear), so this is a data gap on the row, not an honest advisory: MA-1125 codified rule — "registered te + row lacks field = FAIL(a) full stop" — and MA-1141 §449 class apply.

## Expected Behavior (row)
> "Melee or Ranged Attack Roll: +2, reach 5 ft. or range 20/60 ft. Hit: 3 (1d6) Piercing damage plus 2 (1d4) Cold damage. If the target is a creature, its Speed decreases by 10 feet until the end of its next turn. Hit or Miss: The spear magically returns to the merfolk's hand immediately after a ranged attack."

monsters.json merfolk-skirmisher actions[0]: `attack_bonus:2`, `reach:"5 ft."`, `range:"20/60 ft."`, `damage_dice_primary:"1d6"` Piercing, `damage_dice_secondary:"1d4"` Cold, `save_dc:0` decoy. NO `hit_conditions` / `hit_target_effect` / `hit_condition_roll` authored.

## Actual Behavior
- Numeric axis exact: ONE "+2" chip, zero DC chips; 5 fires vs Bandit 1 AC12 — nat2→4 ✗, nat1→3 crit-miss ✗, nat16→18 ✓ ×2, nat13→15 ✓; per hit ONE damage entry primary `"1d6"` Piercing fd 6/4/5 + secondary keys on the SAME entry (`secondaryFormula:"1d4"`, Cold, secFD 2/3/2, note combined_damage_roll); hp −8/−7/−7 unclamped 999→991→984→977; fd+secFD==|hpΔ| exact 3/3.
- Speed rider inert: post-hit, victim change-data `{}` (no speed_reduction te, no targetEffects), whole-log `/speed/i` = 0 hits, cs victim zero speed/condition keys. Zero observable delta.
- No melee/ranged mode chooser ([role=switch]/radiogroup/tablist/select = 0) — reach-first resolution (MA-0672 twin); `rangeReason:null` gridless-lenient.

## Steps to Reproduce
1. localhost:5173 → test-campaign → Encounter Builder → join "Merfolk Skirmisher" ×1 + "Bandit" ×1.
2. Rig Bandit currentHp 999 via trusted keyboard in init-card HP input; arm Bandit 1 as target on Merfolk Skirmisher 1's own initiative card.
3. Open stat card → Ocean Spear row → press "+2" chip until ≥1 hit; press Done (`button.dice-roll-reroll-btn`).
4. Inspect Bandit change-data store, Campaign Log, card Speed — no speed_reduction te / log / modifier appears, ever.

## Likely Location
`public/data/monsters.json` data gap (not resolution code):
- Transport live: generic `hit_target_effect` passthrough `MonsterCardHelpers.js:627/650-651` → `applyHitClauseConditions` → `handlePlainDamage.js:543/611/654`.
- te registered: `src/services/combat/conditions/targetEffectDefinitions.js:1246` (default value 10 = RAW −10 ft); consumer fold `conditionEffects.js:386`; badge `ConditionEffectBadges.jsx:185`; composite twin `targetEffectDefinitions.js:1197-1246` (Ice Devil Ice Spear).
- Prose parsers are save-context only and explicitly null on "Speed reduced by 10 feet": `MonsterCardHelpers.js:70` (`parseSpeedHalfClause`, save_effect), `:81` (`parseSpeedZeroClause`); no "Speed decreases by" matcher exists on any attack-row path.

## Fix
One field on disk row: `hit_target_effect:"speed_reduction"` (MA-0995/MA-0542 slot placement; te default value 10 gives RAW −10 ft). Verify duration stamp resolves target-side ("until the end of its NEXT TURN") vs the Javelin's attacker-side clock.

## Notes
- Returning-spear clause = pure flavor, advisory only, never a defect by itself (MA-0905 honest-advisory family).
- MA-0679 §205 advisory precedent does NOT apply: that is codified for physical movement/token clauses with grep-zero registered producers; here the te is registered AND twins author the field (MA-0769 §212 discriminant).
- Session: EB joins Merfolk Skirmisher 1 + Bandit 1; admin-cleared change-data `{}` + log `[]` GET-verified; console 0 errors.
