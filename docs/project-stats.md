# Project Statistics

> Auto-generated on Mon, Sep 14, 2026 (UTC) — deterministic project-stats scan.

## Summary

| Metric | Production | Test | Total |
|---|---|---|---|
| Source files | 1,224 | 2,007 | 3,231 |
| Source lines | 195,031 | 629,854 | 824,885 |

| Test-to-code ratio | Value |
|---|---|
| Test files / production files | 164.0% |
| Test lines / production lines | 323.0% |

## Language Breakdown

Code files only (JSON excluded). `.jsx`/`.tsx` grouped into their parent language.

| Language | Files | Lines |
|---|---|---|
| JavaScript | 3,231 | 824,885 |
| **Total** | **3,231** | **824,885** |

## JSON

| Category | Files | Lines |
|---|---|---|
| Config JSON (all .json except public/data) | 9 | 47,059 |
| Data JSON (public/data/**) | 32 | 151,104 |

Data JSON: **32** files, avg **4,722** lines/file, median **459** lines/file.

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
| public/data/ | 24 | 117,706 |
| public/data/2024 | 8 | 33,398 |

## File Size Distribution (src/ production code)

Non-test source files under `src/`: **1,193** files, avg **161** lines/file, median **101** lines/file.

| Bucket (lines/file) | Files |
|---|---|
| <50 | 282 |
| 50-200 | 614 |
| 200-500 | 224 |
| 500+ | 73 |

## Largest Production Files (Top 10)

From `src/` and subfolders, excluding JSON and test files.

| # | File | Lines |
|---|---|---|
| 1 | `src/components/encounter/MonsterCardModal.jsx` | 1,323 |
| 2 | `src/services/rules/combat/applyDamage.js` | 1,020 |
| 3 | `src/components/char-sheet/DiceRollResult.jsx` | 1,005 |
| 4 | `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx` | 986 |
| 5 | `src/components/char-sheet/CharActionModals.SecondaryModals.jsx` | 930 |
| 6 | `src/services/combat/conditions/targetEffectDefinitions.js` | 921 |
| 7 | `src/components/char-sheet/CharBonusActions.jsx` | 919 |
| 8 | `src/components/char-sheet/char-summary/CharClassFeatures.jsx` | 904 |
| 9 | `src/components/char-sheet/CharReactions.jsx` | 880 |
| 10 | `src/components/char-sheet/CharSpecialActions.jsx` | 874 |

## Largest Test Files (Top 10)

All test source files (repo-wide), excluding JSON.

| # | File | Lines |
|---|---|---|
| 1 | `src/components/char-sheet/useCharActionsAutomation.test.js` | 1,711 |
| 2 | `src/services/character/featBuffService.computeFeatBuffs.2024.test.js` | 1,311 |
| 3 | `server/routes/notes.test.js` | 1,267 |
| 4 | `src/services/automation/handlers/reactions/reactionBonusHandler.test.js` | 1,156 |
| 5 | `server/routes/spell-overlay.test.js` | 1,143 |
| 6 | `src/services/automation/handlers/class-wizard/portentHandler.test.js` | 1,077 |
| 7 | `src/hooks/combat/useLoggedDiceRollAttack.veer-homing-graze.test.js` | 1,065 |
| 8 | `server/utils/changeData.test.js` | 1,014 |
| 9 | `src/components/char-sheet/CharSpecialActions.modalsInline.test.jsx` | 1,002 |
| 10 | `src/services/automation/handlers/reactions/reactionDamageHandler.test.js` | 989 |

## Largest Data JSON Files (Top 10)

| # | File | Lines |
|---|---|---|
| 1 | `public/data/monsters.json` | 66,747 |
| 2 | `public/data/2024/spells.json` | 14,861 |
| 3 | `public/data/classes.json` | 13,946 |
| 4 | `public/data/2024/classes.json` | 13,601 |
| 5 | `public/data/spells.json` | 10,691 |
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

Comment density: **23,165** comment lines / **801,720** code lines = **0.029** (comment:code, using // and # line markers).

Total dependencies (package.json): **30** (12 runtime + 18 dev).

## Git Churn (last 90 days)

Most-frequently-modified files, excluding generated/binary/runtime dirs (includes `public/data`).

| # | File | Commits |
|---|---|---|
| 1 | `docs/automations-manifest.json` | 295 |
| 2 | `src/components/char-sheet/CharActions.jsx` | 197 |
| 3 | `docs/test-setup-playbook.md` | 195 |
| 4 | `src/services/rules/effects/restRules.js` | 145 |
| 5 | `src/services/rules/spells/spellCastService.js` | 136 |
| 6 | `src/hooks/combat/useLoggedDiceRollAttack.js` | 129 |
| 7 | `src/components/initiative/initiative.jsx` | 127 |
| 8 | `public/data/2024/classes.json` | 124 |
| 9 | `src/services/automation/index.js` | 112 |
| 10 | `src/components/char-sheet/char-spells/CharSpells.jsx` | 109 |

## Methodology & Notes

- Source file types counted: `.js .jsx .ts .tsx .py .go .rs .java .c .h .cpp .hpp .swift .rb .php .sh .yaml .yml`. JSON is tracked separately.
- Test file = path under `/test/ /tests/ /__tests__/ /spec/` or filename matching `*.test.* *.spec.* *_test.* test_*.*`.
- `Data JSON` = `public/data/**`; `Config JSON` = every other `.json` (includes `package-lock.json`, docs manifest/registry files).
- Excluded dirs: `node_modules` (incl. nested), `dist`, `build`, `out`, `.next`, `.vercel`, `coverage`, `.git`, `images` (any depth), plus `.playwright-mcp`, `playwright-report`, `public/assets|images|fonts`, and `public/campaigns` (per-campaign runtime data, not source/config/rules-DB).
- File size distribution & largest production files are scoped to `src/` per the command spec.
