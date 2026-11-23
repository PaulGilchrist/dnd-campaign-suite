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

## Resolution (2026-11-23, fix run)

**Status: FIXED.**

### What was actually wrong
- Confirmed the primary diagnosis: `CharClassFeatures.jsx` Fighter rows read `classLevel.extra_attacks` / `classLevel.second_wind` at top level — keys that exist top-level only in the 2024 table. The 5e table nests `extra_attacks` under `class_specific` and carries NO `second_wind` key, so every 5e Fighter rendered `Extra Attacks: 0` and a dead `Second Wind: 0/0`.
- The same top-level-only read sat THREE places deeper (all zeroing the same pool): the tracked-resource seed (`trackedResources.js` `addMartialResources` — the key was never seeded for 5e Fighters), the short-rest recharge (`restRules-shortRest.js` `addFighterResourceUpdates`) and the ShortRestModal restored-label lane. Net runtime effect: after the first spent use, Second Wind could never recharge (0 < max 0 is false) — permanently unusable.
- **Correction to this file's "Expected" (fix-to-canonical rule):** the 5e ladder "1/2/3/4 at 1/9/13/17" appears NOWHERE in the 5e disk. `public/data/classes.json` Fighter lv1 'Second Wind' says "Once you use this feature, you must finish a short or long rest before you can use it again" — ONE use at every level, and no 5e feature row adds uses (the multi-use ladder is 2024-only and 2024 reads its disk column verbatim: lv1–3:2, lv4–9:3, lv10+:4). Fix derives 5e Second Wind as **max 1**, not the quoted ladder. Extra Attacks expectation stands (level-18 `class_specific.extra_attacks = 2`).
- Census leg (the suggested-fix TODO): `monkExtraAttacks` in the same file had the identical defect — the 5e monk table carries no `extra_attacks` column at all, so every 5e Monk would show `Extra Attacks: 0`; fixed to one Extra Attack at level ≥5 (same threshold idiom `classRules.js` uses for paladin/ranger). Barbarian (`barbarianRageScaling`) and the paladin/ranger rows were checked clean — the bug file's "adjacent suspicion" that `classRules.js:142/:210` caps at 1 is NOT a defect: one Extra Attack is the maximum for paladin/ranger under BOTH rulesets.
- The 5e RUNTIME multi-attack chip count was out of scope here (sheet + resource lanes only), matching this file's own "not ridden" caveat.

### Files changed
- `src/services/rules/trackedResources.js` — new exported `computeSecondWindMax(playerStats)`: single source of truth, mirroring the `computeSuperiorityDiceMax`/`computeActionsurgeMax` dual-shape idiom (Fighter gate; 2024 exact-level disk-row read verbatim; 5e single-use from disk canon). `addMartialResources` seeds through it; `GATED_TRACKED_KEYS` comment updated.
- `src/components/char-sheet/char-summary/CharClassFeatures.jsx` — new `computeExtraAttacksMax(playerStats, classLevel)` mirroring `computeActionsurgeMax` (2024 top-level / 5e `class_specific`); Fighter Second Wind `getMax` now calls the shared `computeSecondWindMax`; `monkExtraAttacks` branches by ruleset.
- `src/services/rules/effects/restRules-shortRest.js` — short-rest Second Wind recharge uses `computeSecondWindMax`.
- `src/components/char-sheet/ShortRestModal.jsx` — restored-label lane uses `computeSecondWindMax`.
- Tests: NEW `src/services/rules/trackedResources.secondWind.test.js` (8 cases pinning both rulesets against the real disk tables); updated pins that locked the legacy top-level reads: `CharClassFeatures.fighter.test.jsx`, `CharClassFeatures.monk.test.jsx`, `trackedResources.test.js` (5e seed law), `restRules-shortRest.test.js` (no-table 5e row still recharges).
- No server, no 2024-module (`classRules2024.js`) changes needed — the 2024 twin lanes read their own table correctly.

### How verified
- Live repro (pre-fix, :5173, cold-disk `rules`→`5e` flip of EvasiveFighter, test-campaign): sheet block `[data-testid="char-class-fighter"]` rendered `Action Surge Uses: 2/2 · Extra Attacks: 0 · Second Wind: 0/0` — exactly as filed.
- Live re-verify (post-fix, same flipped fixture): `Extra Attacks: 2`, `Second Wind: 1/1 (cur/max)`, `Action Surge: 2/2`, `Superiority Dice: 6/6/d12` unchanged. Second Wind is now seeded + recharged (resolver-driven) instead of a dead 0/0 row.
- Controls: fixture restored → 2024 sheet still `Extra Attacks: 2`, `Second Wind: 4/4`; 2024 Monk (Disciplined_Monk lv20) still `Extra Attacks: 1`.
- Fixture restored byte-exact (md5 `0df29ff32250d8baf51fa9e989def28c`); closed-tab admin clears: change-data `{}`, log `[]`.
- `[findFeat] NOT FOUND` console errors while flipped are the pre-documented fixture-abuse artifact (2024 feat names vs 5e feats table), untouched by this fix.
- Vitest: new test 8/8; touched folders all green (trackedResources ×5 files 60 tests, effects ×57 files 488 tests, CharClassFeatures ×6 files 162 tests, ShortRestModal 13 tests); `npm run lint` zero warnings. Full suite: `npm run test:run` → 3532 files / 37530 tests, ALL PASSED.

