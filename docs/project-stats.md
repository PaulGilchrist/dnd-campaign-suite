# Project Statistics

> Auto-generated on Thu, Oct 01, 2026 (UTC) — deterministic project-stats scan.

## Summary

| Metric | Production | Test | Total |
|---|---|---|---|
| Source files | 1,235 | 2,417 | 3,652 |
| Source lines | 207,177 | 720,424 | 927,601 |

| Test-to-code ratio | Value |
|---|---|
| Test files / production files | 195.7% |
| Test lines / production lines | 347.7% |

## Language Breakdown

Code files only (JSON excluded). `.jsx`/`.tsx` grouped into their parent language.

| Language | Files | Lines |
|---|---|---|
| JavaScript | 3,651 | 927,105 |
| Python | 1 | 496 |
| **Total** | **3,652** | **927,601** |

## JSON

| Category | Files | Lines |
|---|---|---|
| Config JSON (all .json except public/data) | 9 | 54,683 |
| Data JSON (public/data/**) | 32 | 153,930 |

Data JSON: **32** files, avg **4,810** lines/file, median **459** lines/file.

### Data JSON size distribution

| Bucket (lines/file) | Files |
|---|---|
| <20 | 5 |
| 20-100 | 7 |
| 100-500 | 4 |
| 500+ | 16 |

### Data JSON by subfolder under `public/data`

| Subfolder | Files | Lines |
|---|---|---|
| public/data/ | 24 | 120,532 |
| public/data/2024 | 8 | 33,398 |

## File Size Distribution (src/ production code)

Non-test source files under `src/`: **1,203** files, avg **169** lines/file, median **102** lines/file.

| Bucket (lines/file) | Files |
|---|---|
| <50 | 277 |
| 50-200 | 613 |
| 200-500 | 237 |
| 500+ | 76 |

## Largest Production Files (Top 10)

From `src/` and subfolders, excluding JSON and test files.

| # | File | Lines |
|---|---|---|
| 1 | `src/components/encounter/MonsterCardHelpers.js` | 3,403 |
| 2 | `src/components/encounter/MonsterCardModal.jsx` | 2,635 |
| 3 | `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx` | 1,800 |
| 4 | `src/hooks/combat/saveProcessing.js` | 1,502 |
| 5 | `src/services/combat/conditions/targetEffectDefinitions.js` | 1,472 |
| 6 | `src/hooks/combat/handlers/handlePlainDamage.js` | 1,128 |
| 7 | `src/components/char-sheet/DiceRollResult.jsx` | 1,126 |
| 8 | `src/services/rules/combat/applyDamage.js` | 1,083 |
| 9 | `src/components/char-sheet/CharActionModals.SecondaryModals.jsx` | 930 |
| 10 | `src/components/char-sheet/CharBonusActions.jsx` | 919 |

## Largest Test Files (Top 10)

All test source files (repo-wide), excluding JSON.

| # | File | Lines |
|---|---|---|
| 1 | `src/services/encounters/monsterLairActions.test.js` | 6,947 |
| 2 | `src/hooks/combat/handlers/handlePlainDamage.hitClause.test.js` | 5,714 |
| 3 | `src/components/encounter/MonsterCardModal.ma0611-djinni-spellcasting.test.jsx` | 3,042 |
| 4 | `src/components/encounter/MonsterCardModal.legendary-uses.test.jsx` | 2,093 |
| 5 | `src/components/char-sheet/useCharActionsAutomation.test.js` | 1,711 |
| 6 | `src/services/encounters/monsterLegendaryUses.test.js` | 1,452 |
| 7 | `src/services/character/featBuffService.computeFeatBuffs.2024.test.js` | 1,311 |
| 8 | `server/routes/notes.test.js` | 1,267 |
| 9 | `src/services/automation/handlers/reactions/reactionBonusHandler.test.js` | 1,156 |
| 10 | `server/routes/spell-overlay.test.js` | 1,143 |

## Largest Data JSON Files (Top 10)

| # | File | Lines |
|---|---|---|
| 1 | `public/data/monsters.json` | 69,549 |
| 2 | `public/data/2024/spells.json` | 14,861 |
| 3 | `public/data/classes.json` | 13,946 |
| 4 | `public/data/2024/classes.json` | 13,601 |
| 5 | `public/data/spells.json` | 10,715 |
| 6 | `public/data/magic-items.json` | 8,827 |
| 7 | `public/data/equipment.json` | 5,089 |
| 8 | `public/data/2024/feats.json` | 3,541 |
| 9 | `public/data/settlement-names.json` | 3,382 |
| 10 | `public/data/shop-names.json` | 2,758 |

## Code Health

| Signal | Count |
|---|---|
| TODO | 0 |
| FIXME | 0 |
| HACK | 0 |

Comment density: **34,348** comment lines / **893,253** code lines = **0.038** (comment:code, using // and # line markers).

Total dependencies (package.json): **31** (13 runtime + 18 dev).

## Git Churn (last 90 days)

Most-frequently-modified files, excluding generated/binary/runtime dirs (includes `public/data`).

| # | File | Commits |
|---|---|---|
| 1 | `docs/monster-actions-manifest.json` | 704 |
| 2 | `public/data/monsters.json` | 588 |
| 3 | `docs/test-setup-playbook.md` | 492 |
| 4 | `docs/automations-manifest.json` | 297 |
| 5 | `src/components/encounter/MonsterCardModal.jsx` | 143 |
| 6 | `src/services/rules/effects/restRules.js` | 127 |
| 7 | `src/components/char-sheet/CharActions.jsx` | 117 |
| 8 | `src/components/initiative/initiative.jsx` | 107 |
| 9 | `src/services/rules/spells/spellCastService.js` | 102 |
| 10 | `src/services/combat/conditions/targetEffectDefinitions.js` | 98 |

## Methodology & Notes

- Source file types counted: `.js .jsx .ts .tsx .py .go .rs .java .c .h .cpp .hpp .swift .rb .php .sh .yaml .yml`. JSON is tracked separately.
- Test file = path under `/test/ /tests/ /__tests__/ /spec/` or filename matching `*.test.* *.spec.* *_test.* test_*.*`.
- `Data JSON` = `public/data/**`; `Config JSON` = every other `.json`.
- Excluded dirs: built-in generated/vendored/binary dirs plus `public/campaigns, .playwright-mcp, playwright-report` from `--exclude`.
- File size distribution & largest production files are scoped to `src/`.
