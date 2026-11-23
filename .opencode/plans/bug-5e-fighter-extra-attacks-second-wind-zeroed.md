# Bug: 5e Fighter sheet zeroes Extra Attacks and Second Wind (rows lack the ruleset branch that Action Surge has)

## Summary
On the 5e ruleset, the Fighter class-features block reads `classLevel.extra_attacks` and `classLevel.second_wind` from the TOP of the merged class-level row. Those keys are top-level only in the 2024 table (`public/data/2024/classes.json`); in the 5e table (`public/data/classes.json`) `extra_attacks` is nested under `class_specific` and `second_wind` does not exist at all. Result: every 5e Fighter renders `Extra Attacks: 0` at all levels and a dead `Second Wind: 0/0` tracked-resource row.

## Steps to reproduce
1. `test-campaign`, server on a dev pair. All 13 fixture characters are `rules: "2024"`.
2. Cold-disk copy-backup then edit `public/campaigns/test-campaign/EvasiveFighter.json`: set top-level `"rules": "5e"` (Human Fighter (Battle Master), level 18; restore the file byte-exact afterwards — md5 `0df29ff32250d8baf51fa9e989def28c`).
3. Reload the GM tab, re-select `test-campaign`, open EvasiveFighter's sheet.
4. Observe the `[data-testid="char-class-fighter"]` block: `Action Surge Uses: 2/2` (correct) but `Extra Attacks: 0` and `Second Wind: 0/0`.
5. Control: restore the file, reload, same sheet → `Extra Attacks: 2`, `Second Wind: 4/4`.

Live-verified both faces 2026-11-23 (explore run) with byte-exact fixture restore. Caveat: the ride used a rules-flipped 2024 file because NO `rules:"5e"` character exists in any campaign on disk (whole repo grepped) — but these two rows read exclusively from the ruleset-selected class table merged in `classRules.getClass` (`classRules.js:28` lodash-merges the 5e `classes.json` Fighter entry over the file's class blob), so a wizard-built genuine 5e Fighter hits the identical data shape. The `[findFeat] NOT FOUND` console errors seen while flipped are fixture-abuse artifacts (2024 feat names vs 5e feats table), not part of this bug.

## Expected behavior
- Extra Attacks for a 5e Fighter level ≥5: 1 (level ≥11: 2; level 20: 3) — source data present as `class_levels[17].class_specific.extra_attacks = 2` at level 18.
- Second Wind usable on 5e (once per short rest, scaling +1 at 9/13/17), never max 0 — a resource row with max 0 is silently unusable.

## Actual behavior
`Extra Attacks: 0` and `Second Wind: 0/0 (cur/max)` with no console error, while the adjacent Action Surge row derives 2/2 correctly from `class_specific.action_surges` on the same 5e row.

## Likely location
Confident (code is unambiguous):
- `src/components/char-sheet/char-summary/CharClassFeatures.jsx:384` — `Extra Attacks: {classLevel.extra_attacks || 0}` and `:396` — `getMax={() => classLevel?.second_wind || 0}`: top-level reads with no `playerStats.rules` branch.
- Contrast the sibling helper that DOES branch: `computeActionsurgeMax` (`CharClassFeatures.jsx:322-328`) — 2024 hardcoded ladder, 5e `classLevel?.class_specific?.action_surges || 0`.
- Data asymmetry: `public/data/classes.json` Fighter `class_levels[17]` = `{class_specific:{action_surges:2, indomitable_uses:3, extra_attacks:2}}` vs `public/data/2024/classes.json` `class_levels[17]` = `{extra_attacks:2, second_wind:4, superiority_dice:6, ...}`.

## Suggested fix
Mirror the Action Surge pattern: a `computeExtraAttacksMax(playerStats, classLevel)` returning `classLevel.extra_attacks ?? classLevel?.class_specific?.extra_attacks ?? 0`, and a 5e branch for Second Wind computed from level (PHB ladder 1/2/3/4 at 1/9/13/17) since the 5e table carries no second-wind key. Also census the other class feature blocks in the same file for top-level `classLevel.*` reads that only exist in the 2024 shape (the Barbarian block already handles both via `barbarianRageScaling`, so the pattern exists).

## Severity
Broken feature — the dual-ruleset promise ("both rulesets coexist in one campaign") ships a Fighter whose sheet misreports attack scaling and cannot use Second Wind once anyone plays a 5e character. Currently masked only because no 5e character exists in any campaign yet.
