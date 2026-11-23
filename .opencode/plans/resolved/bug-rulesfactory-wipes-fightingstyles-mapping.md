# Bug: rulesFactory's class re-assignment silently kills the top-level `fightingStyles` mapping — shipped Fighter sheet renders "Fighting Styles: N/A"

## Summary
`rules.getPlayerStats` (shared core) maps a character file's TOP-LEVEL `fightingStyles` array onto `playerStats.class.fightingStyles`… and then `rulesFactory.getPlayerStats`, two lines after awaiting it, REPLACES `playerStats.class` with a fresh `cr.getClass(...)` merge, wiping the mapping. Any character whose file carries the top-level shape (the shipped `EvasiveFighter` fixture does) permanently shows `Fighting Styles: N/A` on the sheet and silently misses every downstream `class.fightingStyles` consumer.

## Steps to reproduce
1. `test-campaign`, GM localhost tab. `public/campaigns/test-campaign/EvasiveFighter.json` carries top-level `"fightingStyles": ["Superior Technique"]` and NO `class.fightingStyles`.
2. Open EvasiveFighter's character sheet (sidebar Characters → EvasiveFighter).
3. Fighter class-features block (`[data-testid="char-class-fighter"]`) shows `Fighting Styles: N/A`.
4. React-fiber probe on that node's `playerStats` confirms: `playerStats.fightingStyles = ["Superior Technique"]` but `playerStats.class.fightingStyles === undefined` (full class keys enumerated live 2026-11-23).
5. Control: DraconicDragon's file carries `class.fightingStyles: ["Great Weapon Fighting"]` and its sheet renders the styles honestly — the wizard/quick-build shape (`quickBuildService.js:235` writes `draft.class.fightingStyles`) survives `getClass`'s lodash merge; only the top-level-shape character is affected.

## Expected behavior
Either the documented mapping in `rules.js:451-453` takes effect (sheet shows `Superior Technique`, automation gates see it), or the mapping is deleted and the data shape is migrated — per the repo's no-legacy policy the code should have exactly ONE canonical shape and it should work. Right now the mapping is live code that is a guaranteed no-op, and the fixture's data dies silently (no console error, `|| 0` / `N/A` fallbacks everywhere).

## Actual behavior
`Fighting Styles: N/A` on the sheet; the mapping never reaches any consumer. Silent.

## Likely location
Confident:
- `src/services/rules/rules.js:451-453` — `if (playerStats.fightingStyles && !playerStats.class.fightingStyles) playerStats.class.fightingStyles = playerStats.fightingStyles;` (runs inside `rules.getPlayerStats`).
- `src/services/rules/rulesFactory.js:105` — `playerStats.class = cr.getClass(allClasses, playerSummary);` ("Re-read class/race … because rules.getPlayerStats may have set them differently") — executes AFTER the mapping and discards it.
- Downstream consumers that then see nothing: `CharClassFeatures.jsx:385` (display), `src/services/combat/automation/automationExpressions.js:62-63` (Superior Technique → d6 superiority die), `src/services/character/race-rules/2024.js:166` and `5e.js:110` (Blind Fighting reach/advantage gates).

## Suggested fix
Decide the one canonical shape. Given `quickBuildService` writes `class.fightingStyles` and DraconicDragon already uses it, canonical is `class.fightingStyles`. Per the no-legacy-compat-sweep policy: migrate the fixture data once on cold disk (move EvasiveFighter's top-level array into `class.fightingStyles`; decide DraconicDragon's stray top-level `["Dueling"]` — it is currently dead data), DELETE the `rules.js:451-453` dual-reader, and grep for any other code that assumes the lift happened. If instead the top-level shape is meant to be supported, re-apply the mapping AFTER the class re-assignment in `rulesFactory.getPlayerStats` — but that entrenches the dual shape the policy forbids.

## Severity
Minor UX issue escalating to data-integrity-adjacent: no crash and both current wizard-shaped characters render fine, but a live console-silent code path lies about its contract, a shipped fixture renders N/A for data it declares, and any future consumer of the mapping (Blind Fighting, Superior Technique dice) silently no-ops.

## Resolution
**FIXED 2026-11-23** — canonical shape chosen per the no-legacy-compat policy: `class.fightingStyles` (the wizard/quick-build writer and every consumer already speak it; both `getClass` implementations carry it — 5e via lodash merge `classRules.js:33`, 2024 via `Object.assign` `classRules2024.js:97-100`).

Root cause was exactly as diagnosed: `rules.getPlayerStats` lifted the file's TOP-LEVEL `fightingStyles` onto `playerStats.class.fightingStyles`, then `rulesFactory.getPlayerStats` (`rulesFactory.js:103`) replaced `playerStats.class` with a fresh `cr.getClass(allClasses, playerSummary)` merge built from the RAW file — the lift never reached any consumer. Live repro re-confirmed first: EvasiveFighter sheet `[data-testid="char-class-fighter"]` rendered `Fighting Styles: N/A` with fiber probe `playerStats.fightingStyles = ['Superior Technique']` / `playerStats.class.fightingStyles === undefined`.

Changes:
- `public/campaigns/test-campaign/EvasiveFighter.json` — migrated top-level `"fightingStyles": ["Superior Technique"]` into `class.fightingStyles` (the one canonical shape). Dice lane unaffected: EF is a Battle Master, so `automationExpressions.js:62-63` keeps the subclass d12 by design (`majorName !== 'Battle Master'` guard).
- `public/campaigns/test-campaign/DraconicDragon.json` — DELETED the stray top-level `["Dueling"]` (never reached any consumer — the class already carried `class.fightingStyles` so the lift never fired; removal is behavior-preserving). NOT merged into `class.fightingStyles`: promoting a style the engine has never honored would be a gameplay-content decision, not a migration.
- `src/services/rules/rules.js` — DELETED the no-op lift block (former :451-453).
- `src/services/character/rulesetSwitchPreview.js` — `hasChosenFightingStyle` dual-reader now reads `class.fightingStyles` only (the retired top-level branch was unpinned legacy leniency).
- `src/config/constants.js` — removed the top-level `fightingStyles: []` from `DEFAULT_FORM_DATA` (the wizard writes `class.fightingStyles`; the template key is what minted the dead top-level `[]` into every wizard-created file — visible in Frostfall/Testing fixtures, left untouched there as production data that reads inert).
- `src/services/rules/rules.getPlayerStats.test.js` — 5e golden moved to the canonical shape (mock `getClass`s updated to mirror the real merge-carry contract); added T6 no-legacy pin: a retired top-level array grants NOTHING to `class` (exact `toStrictEqual`).
- **New** `src/services/rules/rulesFactory.fightingStyles.test.js` — regression lane running the REAL `classRules.getClass`/`classRules2024.getClass` through `rulesFactory.getPlayerStats`: T1/T1b pin file-carried `class.fightingStyles` SURVIVING the :103 class re-assignment for both rulesets (with merge neighbors — subclass/major/class_levels/proficiencies — intact); T2 pins the retired lift stays dead at the factory seam.

Verification:
- Live re-ride on :5173 (test-campaign, GM localhost): EvasiveFighter Fighter block now reads `Fighting Styles: Superior Technique`; fiber probe `playerStats.class.fightingStyles = ['Superior Technique']`, `'Superior Technique' in includes`, `Combat Superiority` special action present, `_trackedResources.superiorityDice` registered. Control DraconicDragon unchanged (`class.fightingStyles = ['Great Weapon Fighting']`, sheet still renders it, top-level absent). Wizard edit-open smoke (mount merge + Ruleset step) opens/closes zero-write.
- Tests: new lane 3/3; `src/services/rules/` folder 378 files/3930 tests; `rules+character+hooks/wizard` 462 files/5221 tests; FULL suite `npm run test:run` 3535 files / 37539 tests, all green. `npm run lint` zero warnings; `no-timers-guard` OK.
- Closeout: closed-tab two-pass admin clear — change-data `{}`, log `[]`, overlays `[]` after each pass.
