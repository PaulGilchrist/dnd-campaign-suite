# Project Statistics

> Auto-generated on Wed, Nov 25, 2026 (UTC) — deterministic project-stats scan.

## Summary

| Metric | Production | Test | Total |
|---|---|---|---|
| Source files | 1,516 | 3,581 | 5,097 |
| Source lines | 274,822 | 838,042 | 1,112,864 |

| Test-to-code ratio | Value |
|---|---|
| Test files / production files | 236.2% |
| Test lines / production lines | 304.9% |

## Language Breakdown

Code files only (JSON excluded). `.jsx`/`.tsx` grouped into their parent language.

| Language | Files | Lines |
|---|---|---|
| JavaScript | 5,096 | 1,112,825 |
| Python | 1 | 39 |
| **Total** | **5,097** | **1,112,864** |

## JSON

| Category | Files | Lines |
|---|---|---|
| Config JSON (all .json except public/data) | 9 | 50,834 |
| Data JSON (public/data/**) | 32 | 160,414 |

Data JSON: **32** files, avg **5,013** lines/file, median **459** lines/file.

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
| public/data/ | 24 | 126,931 |
| public/data/2024 | 8 | 33,483 |

## File Size Distribution (src/ production code)

Non-test source files under `src/`: **1,443** files, avg **181** lines/file, median **105** lines/file.

| Bucket (lines/file) | Files |
|---|---|
| <50 | 336 |
| 50-200 | 722 |
| 200-500 | 278 |
| 500+ | 107 |

## Largest Production Files (Top 10)

From `src/` and subfolders, excluding JSON and test files.

| # | File | Lines |
|---|---|---|
| 1 | `src/components/encounter/MonsterCardHelpers.js` | 3,499 |
| 2 | `src/components/encounter/MonsterCardModal.jsx` | 3,342 |
| 3 | `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx` | 2,223 |
| 4 | `src/hooks/combat/saveProcessing.js` | 1,813 |
| 5 | `src/services/combat/conditions/targetEffectDefinitions.js` | 1,580 |
| 6 | `src/components/party-inventory/PartyInventory.jsx` | 1,431 |
| 7 | `src/services/rules/combat/applyDamage.js` | 1,320 |
| 8 | `src/components/initiative/Initiative.jsx` | 1,316 |
| 9 | `src/App.jsx` | 1,309 |
| 10 | `src/hooks/combat/handlers/handlePlainDamage.js` | 1,300 |

## Largest Test Files (Top 10)

All test source files (repo-wide), excluding JSON.

| # | File | Lines |
|---|---|---|
| 1 | `src/components/encounter/MonsterCardModal.legendary-uses.test.jsx` | 1,892 |
| 2 | `server/routes/log.test.js` | 1,382 |
| 3 | `server/routes/maps.test.js` | 1,370 |
| 4 | `server/utils/changeData.test.js` | 1,348 |
| 5 | `server/routes/notes.test.js` | 1,278 |
| 6 | `src/services/combat/automation/automationInfoBuilder/core-handlers.test.js` | 1,237 |
| 7 | `server/routes/spell-overlay.test.js` | 1,203 |
| 8 | `src/components/char-sheet/modals/divine/DivineSparkModal.test.jsx` | 1,109 |
| 9 | `src/services/automation/handlers/reactions/reactionBonusHandler.test.js` | 1,088 |
| 10 | `src/services/automation/handlers/spells/summonSpiritHandler.test.js` | 1,025 |

## Largest Data JSON Files (Top 10)

| # | File | Lines |
|---|---|---|
| 1 | `public/data/monsters.json` | 75,536 |
| 2 | `public/data/2024/spells.json` | 14,920 |
| 3 | `public/data/classes.json` | 13,946 |
| 4 | `public/data/2024/classes.json` | 13,603 |
| 5 | `public/data/spells.json` | 11,128 |
| 6 | `public/data/magic-items.json` | 8,827 |
| 7 | `public/data/equipment.json` | 5,088 |
| 8 | `public/data/2024/feats.json` | 3,554 |
| 9 | `public/data/settlement-names.json` | 3,382 |
| 10 | `public/data/shop-names.json` | 2,758 |

## Code Health

| Signal | Count |
|---|---|
| TODO | 0 |
| FIXME | 4 |
| HACK | 3 |

Comment density: **122,378** comment lines / **990,486** code lines = **0.124** (comment:code, using // and # line markers).

Total dependencies (package.json): **32** (13 runtime + 19 dev).

## Git Churn (last 90 days)

Most-frequently-modified files, excluding generated/binary/runtime dirs (includes `public/data`).

| # | File | Commits |
|---|---|---|
| 1 | `docs/test-setup-playbook.md` | 1,774 |
| 2 | `docs/app-exploration.md` | 999 |
| 3 | `docs/monster-actions-manifest.json` | 779 |
| 4 | `public/data/monsters.json` | 656 |
| 5 | `docs/automations-manifest.json` | 378 |
| 6 | `docs/test-monster-registry.json` | 278 |
| 7 | `docs/test-character-registry.json` | 267 |
| 8 | `src/components/encounter/MonsterCardModal.jsx` | 140 |
| 9 | `src/components/encounter/MonsterCardHelpers.js` | 93 |
| 10 | `src/services/encounters/monsterLairActions.test.js` | 86 |

## Methodology & Notes

- Source file types counted: `.js .jsx .ts .tsx .py .go .rs .java .c .h .cpp .hpp .swift .rb .php .sh .yaml .yml`. JSON is tracked separately.
- Test file = path under `/test/ /tests/ /__tests__/ /spec/` or filename matching `*.test.* *.spec.* *_test.* test_*.*`.
- `Data JSON` = `public/data/**`; `Config JSON` = every other `.json`.
- Excluded dirs: built-in generated/vendored/binary dirs plus `public/campaigns, .playwright-mcp, playwright-report` from `--exclude`.
- File size distribution & largest production files are scoped to `src/`.
