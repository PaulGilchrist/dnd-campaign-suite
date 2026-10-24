# Project Statistics

> Auto-generated on Sat, Oct 24, 2026 (UTC) — deterministic project-stats scan.

## Summary

| Metric | Production | Test | Total |
|---|---|---|---|
| Source files | 1,304 | 2,769 | 4,073 |
| Source lines | 228,862 | 679,350 | 908,212 |

| Test-to-code ratio | Value |
|---|---|
| Test files / production files | 212.3% |
| Test lines / production lines | 296.8% |

## Language Breakdown

Code files only (JSON excluded). `.jsx`/`.tsx` grouped into their parent language.

| Language | Files | Lines |
|---|---|---|
| JavaScript | 4,072 | 908,173 |
| Python | 1 | 39 |
| **Total** | **4,073** | **908,212** |

## JSON

| Category | Files | Lines |
|---|---|---|
| Config JSON (all .json except public/data) | 10 | 59,389 |
| Data JSON (public/data/**) | 32 | 159,483 |

Data JSON: **32** files, avg **4,984** lines/file, median **459** lines/file.

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
| public/data/ | 24 | 126,051 |
| public/data/2024 | 8 | 33,432 |

## File Size Distribution (src/ production code)

Non-test source files under `src/`: **1,256** files, avg **177** lines/file, median **108** lines/file.

| Bucket (lines/file) | Files |
|---|---|
| <50 | 268 |
| 50-200 | 659 |
| 200-500 | 242 |
| 500+ | 87 |

## Largest Production Files (Top 10)

From `src/` and subfolders, excluding JSON and test files.

| # | File | Lines |
|---|---|---|
| 1 | `src/components/encounter/MonsterCardHelpers.js` | 3,479 |
| 2 | `src/components/encounter/MonsterCardModal.jsx` | 2,949 |
| 3 | `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx` | 2,052 |
| 4 | `src/hooks/combat/saveProcessing.js` | 1,754 |
| 5 | `src/services/combat/conditions/targetEffectDefinitions.js` | 1,552 |
| 6 | `src/hooks/combat/handlers/handlePlainDamage.js` | 1,272 |
| 7 | `src/services/rules/combat/applyDamage.js` | 1,265 |
| 8 | `src/services/rules/spells/spellPreparationService.js` | 1,148 |
| 9 | `src/components/char-sheet/DiceRollResult.jsx` | 1,125 |
| 10 | `src/components/char-sheet/CharBonusActions.jsx` | 1,087 |

## Largest Test Files (Top 10)

All test source files (repo-wide), excluding JSON.

| # | File | Lines |
|---|---|---|
| 1 | `src/components/encounter/MonsterCardModal.legendary-uses.test.jsx` | 1,892 |
| 2 | `server/routes/notes.test.js` | 1,267 |
| 3 | `src/services/combat/automation/automationInfoBuilder/core-handlers.test.js` | 1,237 |
| 4 | `server/routes/spell-overlay.test.js` | 1,143 |
| 5 | `server/routes/maps.test.js` | 1,116 |
| 6 | `src/services/automation/handlers/reactions/reactionBonusHandler.test.js` | 1,088 |
| 7 | `server/utils/changeData.test.js` | 1,039 |
| 8 | `src/services/automation/handlers/spells/summonSpiritHandler.test.js` | 1,003 |
| 9 | `server/routes/npcs.test.js` | 939 |
| 10 | `src/services/automation/handlers/class-ranger/primalCompanionHandler.test.js` | 914 |

## Largest Data JSON Files (Top 10)

| # | File | Lines |
|---|---|---|
| 1 | `public/data/monsters.json` | 75,031 |
| 2 | `public/data/2024/spells.json` | 14,879 |
| 3 | `public/data/classes.json` | 13,946 |
| 4 | `public/data/2024/classes.json` | 13,603 |
| 5 | `public/data/spells.json` | 10,753 |
| 6 | `public/data/magic-items.json` | 8,827 |
| 7 | `public/data/equipment.json` | 5,088 |
| 8 | `public/data/2024/feats.json` | 3,545 |
| 9 | `public/data/settlement-names.json` | 3,382 |
| 10 | `public/data/shop-names.json` | 2,758 |

## Code Health

| Signal | Count |
|---|---|
| TODO | 0 |
| FIXME | 11 |
| HACK | 5 |

Comment density: **90,228** comment lines / **817,984** code lines = **0.110** (comment:code, using // and # line markers).

Total dependencies (package.json): **31** (13 runtime + 18 dev).

## Git Churn (last 90 days)

Most-frequently-modified files, excluding generated/binary/runtime dirs (includes `public/data`).

| # | File | Commits |
|---|---|---|
| 1 | `docs/monster-actions-manifest.json` | 779 |
| 2 | `docs/test-setup-playbook.md` | 704 |
| 3 | `public/data/monsters.json` | 665 |
| 4 | `docs/automations-manifest.json` | 467 |
| 5 | `src/components/encounter/MonsterCardModal.jsx` | 138 |
| 6 | `src/services/combat/conditions/targetEffectDefinitions.js` | 105 |
| 7 | `src/components/encounter/MonsterCardHelpers.js` | 87 |
| 8 | `src/services/encounters/monsterLairActions.test.js` | 85 |
| 9 | `src/components/char-sheet/char-spells/CharSpells.jsx` | 77 |
| 10 | `src/components/initiative/initiative.jsx` | 77 |

## Methodology & Notes

- Source file types counted: `.js .jsx .ts .tsx .py .go .rs .java .c .h .cpp .hpp .swift .rb .php .sh .yaml .yml`. JSON is tracked separately.
- Test file = path under `/test/ /tests/ /__tests__/ /spec/` or filename matching `*.test.* *.spec.* *_test.* test_*.*`.
- `Data JSON` = `public/data/**`; `Config JSON` = every other `.json`.
- Excluded dirs: built-in generated/vendored/binary dirs plus `public/campaigns, .playwright-mcp, playwright-report` from `--exclude`.
- File size distribution & largest production files are scoped to `src/`.
