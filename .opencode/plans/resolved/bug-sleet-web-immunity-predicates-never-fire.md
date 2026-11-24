# Bug: Sleet Storm / Web player-immunity predicates call async `getCombatContext` without `await` — immunity silently never applies

## Summary

Two automation handlers run their player-condition-immunity checks through predicates that read `getCombatContext(campaignName)?.creatures` SYNCHRONOUSLY — but `getCombatContext` (`src/services/rules/combat/damageUtils.js:41`) is async, so the expression evaluates against a Promise and `?.creatures` is always `undefined`. Consequence: a PLAYER target is never recognized (`targetCharacter?.type` is undefined), so the immunity short-circuit never fires — `sleetStormHandler.js:286` (`shouldSkipSleetAreaSave`'s prone-immunity leg: an already-prone check runs but the `playerIsImmuneToCondition('prone')` branch is unreachable) and `webAreaSaveHandler.js:249` (`webTargetIsImmune` returns `false` for EVERY target, incl. genuinely Restrained-immune PCs). Immune player characters silently take Prone/Restrained from these area spells. Both sites have been formally witnessed and flagged `PRODUCTION DEFECT (pre-existing, reported)` in `sleetStormHandler.areaSave.test.js:37` and `webAreaSaveHandler.areaSave.test.js:64` (cross-ref #1989). This is the final remnant of the `getCombatContext` await census that fixed `savePath.js:180` (`2b8a16573`) and `saveAttackHandler.js:277` (`1be510ef8`) — those two lanes flipped the picker UI; THIS one is adjudication-correctness: the conditions actually land on immune characters.

## Steps to reproduce

1. Unit-level (already pinned as known-red-documented behavior): the `PRODUCTION DEFECT` headers in the two `.areaSave.test.js` files describe the mock-vs-production divergence; a test that mocks `getCombatContext` ASYNC (per the `2b8a16573` contract) proves the predicate sees no creatures.
2. Live in test-campaign: seed `computedStats` for a PC carrying a prone-immunity (or restrained-immunity) feature, or use any existing PC the immunity rule matches; POST a sleet-storm/web area effect at the board including that PC; observe the Prone/Restrained condition lands despite immunity (log `condition` row + condition badge on the card).

## Expected behavior

`playerIsImmuneToCondition` gates actually evaluate: immune players are skipped (no condition applied, no damage-side condition rider), non-immune resolve exactly as today.

## Actual behavior

Immunity check is structurally unreachable — every player is treated as non-immune AND as not-a-player (`targetCharacter` undefined), so the `type === 'player'` leg never runs at all.

## Likely location

- `src/services/automation/handlers/spells/sleetStormHandler.js:286` — inside a SYNC predicate (`shouldSkipSleetAreaSave` era function); fixing requires threading async through the predicate and its call sites.
- `src/services/automation/handlers/spells/webAreaSaveHandler.js:249` — `webTargetIsImmune`, same class.
- Ground-truth pattern to mirror: `sleetStormHandler.js` / sibling handlers that already `await getCombatContext(...)` (census-clean consumers per the 2026-11-23 fixes); `playerIsImmuneToCondition`'s own contract in the conditions services.

## Suggested fix

Make both predicates `async` (returning Promises the awaiting caller already handles), `await` the `getCombatContext` call, and thread the await through each predicate's call sites (verify every caller is in an async chain — the AoE save lanes are). NO compat fallback and no sync-cache inference — keep exactly one canonical async contract, mirroring `2b8a16573`. Then: flip the two test files' sync mocks to the async contract, CONVERT the `PRODUCTION DEFECT` header flags into live pins (immune-player-skips + non-immune-still-resolves per handler), and check the dual-ruleset routings.

## Severity

Adjudication correctness (worse than the two resolved UI twins): conditions that rules say cannot apply, DO apply to player characters — silent rules violation at the table. Severity was acknowledged and flagged in-test (#1989) before being queued here.

## Resolution (FIXED 2026-11-23, fix subagent — final site of the `getCombatContext` await census)

**Actual cause — one limb MORE than filed.** Census of both predicates found exactly one
call site each, both already inside async chains (`shouldSkipSleetAreaSave` is `async` and
awaited by its sole caller `processSleetStormAreaSave:369`; `webTargetIsImmune`'s sole caller
`processWebAreaSave:332` is `async`), so threading cost nothing:

1. **Limb A (as filed):** `getCombatContext(campaignName)?.creatures` un-awaited →
   `?.creatures` undefined on a Promise → `targetCharacter` undefined → the
   `type === 'player'` branch never ran.
2. **Limb B (found while root-causing — awaiting alone does NOT satisfy the Expected
   behavior):** the branch built `playerStats: { computedStats: getRuntimeValue(targetName,
   'computedStats', campaignName) }` — a WRAPPER object. `playerIsImmuneToCondition`
   (`automationImmunities.js:134`) reads `playerStats.name/.immunities/.allFeatures` at the
   TOP level (its own tests + every damage-lane caller pass the FULL stats — codebase
   identity `computedStats === playerStats`, e.g. `App.jsx:733`, `SetConditionModal.jsx:31`,
   `useLoggedDiceRollEventHandlers.js:129`); nothing reads a nested `computedStats` key, so
   even awaited, the gate returned `false` for EVERY target and no seedable data could make
   an immune PC skip. Limb B is fixed here by passing the bucket directly as the stats
   object (the runtime lane `seedCharServerKeys`/`App.jsx:427` seeds bucket keys verbatim,
   so a character bucket's `computedStats` value IS the stats object).

**Files changed**
- `src/services/automation/handlers/spells/sleetStormHandler.js` — `shouldSkipSleetAreaSave`:
  `(await getCombatContext(campaignName))?.creatures?.find(...)` (mirrors the awaited grease
  twin `greaseAreaSaveHandler.js:140`) + raw-bucket `playerStats`.
- `src/services/automation/handlers/spells/webAreaSaveHandler.js` — `webTargetIsImmune`
  made `async` with the same awaited read + raw-bucket `playerStats`; sole caller now
  `if (await webTargetIsImmune(...)) return null;` (mirrors grease `:221`). Non-immune
  targets byte-identical: NPC rows never reach the call (type gate), null bucket →
  `playerIsImmuneToCondition`'s own `!playerStats` guard → false.
- `src/services/automation/handlers/spells/sleetStormHandler.areaSave.test.js` — header
  `PRODUCTION DEFECT` flag RETIRED; `monsterContext` flipped `mockReturnValue` →
  `mockResolvedValue` (async contract per `2b8a16573`) + new `playerContext`; the old
  sync-mock immunity test CONVERTED into four live pins: immune-player-skips (raw-bucket
  call shape pinned), non-immune-player-resolves, null-bucket-resolves, and
  NPC-unaffected-by-immunity-leg (seeded bucket present, awaited MONSTER row gates the call
  out). A dropped await or a re-introduced wrapper fails the pins.
- `src/services/automation/handlers/spells/webAreaSaveHandler.areaSave.test.js` — same
  conversion: flag retired, immunity gates rewritten on `mockResolvedValue` rows with the
  raw-bucket pin + skip/resolve/null/NPC trio.
- `src/services/automation/handlers/spells/webAreaSaveHandler.edgeCases.test.js` — stale
  cross-ref comment updated (defect retired).
- Dual-ruleset: NO 2024 twin — both rulesets share these exact handlers (single dispatch
  table `automation/index.js:557/558/585`; the recurring lane fires via `expireStaleEffects.js`
  Phase 3/5 which imports the handler modules directly, ruleset-agnostic). Pinned once here.

**Before/after live evidence (test-campaign, dev pair :5173, GM localhost; rig = seeded
runtime lane, NOT unit mocks):** seeded `combatSummary` (DivinationWizard + EvasiveFighter +
`Goblin Ctrl` npc), caster bucket `_sleetStorm_/_web_DivinationWizard` tracking (saveDc
raised to 40 so EF's +14/+12 saves can fail), campaign `targetEffects` with sleet+web zone
tes on the PC and the NPC, and `EvasiveFighter` bucket `computedStats:{name,
immunities:['prone','restrained']}` (no roster PC carries prone/restrained immunity
naturally — grep of `passive_immunity`/`conditionImmunity` in the 14 files is empty — so the
seed IS the qualifying lane; the zone handlers' only production-readable stats source).
- BEFORE (live source, fresh mount, handler driven via in-page module import): Web at the
  immune PC ARMED `savePrompt-EvasiveFighter-*` + `ability_use`/`save_result` rows; failed
  DC-40 save landed `activeConditions:["restrained"]` on the immune PC. Sleet at the same PC
  ARMED a DEX prompt and landed `prone`. Control NPC `Goblin Ctrl` correctly took
  Restrained. Defect fully witnessed (both legs, plus the promise-resolution adjudication).
- AFTER (same rig, reloaded source): both handlers return `null` for the immune PC — zero
  `savePrompt-*` keys, zero new log rows, no conditions. The REAL wired seam was then
  driven honestly (top-level `activeCreatureName` POST → mounted-tab echo sweep → Phase 3):
  the sweep skipped the immune PC silently and armed ONLY the control NPC's DEX prompt;
  failed save landed `prone` on `Goblin Ctrl`. Non-immune sanity: Web at `AasimarTest`
  (no seeded bucket) still armed, failed, and landed `restrained` — unchanged.

**Census finale:** `rg 'getCombatContext\(' src` minus awaited/`.then`ed sites now returns
ZERO production hits (the two flagged lines were the last).

**OPEN companion defect filed** (owner ownership-law, NOT fixed here — out of this ticket's
two-handler scope): `bug-grease-stinking-zone-save-immunity-wrapper-inert.md` — the grease
and stinking-cloud recurring-save predicates await correctly but still pass the inert
`{computedStats}` wrapper (limb B), so their player-immunity gates remain structurally
false; plus nobody writes any character's `computedStats` bucket in production, so the
whole zone family's gate is data-starved for REAL player characters until a hydration lane
lands (my fix makes the gate evaluate the moment data exists; seeding proved it).

**Gates:** touched 2 test files 51/51 → `npx vitest run src/services/automation/handlers/
spells src/services/automation/handlers/combat` 204 files / 2970 tests → `npm run lint`
clean (exit 0) → `node .opencode/plans/no-timers-guard.mjs` OK (47 benign sites) → FULL
SUITE (background-bounded) run 1: `3547 files / 37667 tests` (baseline 37663 + the 4 new
immunity pins, file count identical) with ONE failure in
`src/components/character-creation/WizardStepBasic.test.jsx` ("changing alignment sends
(alignment, value)") — an unrelated character-wizard lane with zero diffs this change, which
passes in isolation (twice, 16/16). CLEAN RE-RUN: **`Test Files 3547 passed (3547) /
Tests 37667 passed (37667) / EXIT: 0`** — baseline holds with the new pins added; the run-1
wizard failure was a parallel-run flake.

**Cleanup:** browser tab closed, Admin clear-change-data + clear-log (server back to
`{}` / `[]`), overlays `[]`, no character FILES touched — 14-file aggregate
`514ec55f3671ab207833c0e8fdb0a84b` re-verified intact.
