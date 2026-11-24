# Bug: Grease / Stinking Cloud recurring-save immunity predicates pass an inert `{computedStats}` wrapper — player-immunity gates structurally always false (limb B of the fixed sleet/web class)

## Summary

The 2026-11-23 fix `resolved/bug-sleet-web-immunity-predicates-never-fire.md` root-caused the
sleet/web area-save immunity gates as a TWO-limb defect: (A) `getCombatContext` un-awaited,
(B) the stats handed to `playerIsImmuneToCondition` were wrapped as
`{ computedStats: <bucket> }` — a shape that NONE of `playerIsImmuneToCondition`'s rule legs
read (it consumes top-level `playerStats.name/.immunities/.allFeatures` —
`src/services/combat/automation/automationImmunities.js:134`; every working caller passes
FULL stats: `computedStats || character` per `SetConditionModal.jsx:31`,
`useLoggedDiceRollEventHandlers.js:129`, and the codebase identity `computedStats ===
playerStats` at `App.jsx:733`). Limb A was NEVER present in the grease/stinking twins (both
already awaited correctly — census-clean), but limb B is IDENTICAL and still shipped:
`greaseAreaSaveHandler.js:142-144` (`greaseTargetIsImmune`) and
`stinkingCloudHandler.js:82-84` (`stinkingCloudTargetImmune`) wrap the target's
`computedStats` runtime bucket one level too deep, so the gate returns `false` for EVERY
player — immune PCs still take Prone from Grease and Poisoned from Stinking Cloud recurring
zone saves.

## Steps to reproduce

1. Unit: mock `playerIsImmuneToCondition` with a spy, run `processGreaseAreaSave` /
   `processStinkingCloudAreaSave` at a `type:'player'` row with the runtime router returning
   `{name, immunities:['prone']}` for the `computedStats` key — the spy is called with
   `{computedStats: {...}}` (wrapper), and `automationImmunities.test.js` proves no rule leg
   reads that shape.
2. Live (test-campaign rig from the sleet/web resolution, same seeds swapped to
   `effect:'grease'` / `'stinking_cloud'` tes + `_grease_/_stinkingCloud_<caster>` tracking):
   seed the PC bucket `computedStats:{name, immunities:['prone']}` (grease) — walk the seam —
   the prompt still arms and Prone lands.

## Expected behavior

Same as the fixed twins: pass the bucket value directly as `playerStats` (raw stats object),
so `playerIsImmuneToCondition` gates actually evaluate; immune players are skipped, no save
is armed, non-immune resolve byte-identical.

## Actual behavior

Gate structurally false for every player (wrapper leg-unread), exactly limb B of the
resolved class.

## Likely location

- `src/services/automation/handlers/spells/greaseAreaSaveHandler.js:139-151` (`greaseTargetIsImmune`)
- `src/services/automation/handlers/spells/stinkingCloudHandler.js:76-91` (`stinkingCloudTargetImmune`)

## Suggested fix

Mirror `resolved/bug-sleet-web-immunity-predicates-never-fire.md` limb B verbatim: pass
`getRuntimeValue(targetName, 'computedStats', campaignName)` directly as `playerStats`
(no wrapper), re-pin the immunity tests to the raw-bucket call shape (grease's
`greaseAreaSaveHandler.areaSave.test.js:206` currently pins the WRAPPER shape — it must flip
with the fix), and flip the stinking twin likewise.

## Also owed (same ticket, second gap)

No production lane WRITES any character's `computedStats` change-data bucket (repo-wide grep:
only the four zone-handler readers + test routers; `seedCharServerKeys`/`App.jsx:427` merely
seeds whatever the bucket holds). Until a hydration lane stamps the character's computed
stats into that bucket, the whole zone family's gate — including the just-fixed sleet/web —
evaluates against real data only when seeded. Decide the canonical writer (or an in-handler
stats resolver) so REAL immune PCs skip without harness seeding.

## Severity

Adjudication correctness (same class as #1989): documented/seeded immunity silently ignored
at the table for Grease and Stinking Cloud recurring saves.

## Resolution (limb B FIXED 2026-11-23, fix subagent; hydration gap → open follow-up filed)

**Limb B (this ticket's subject) — FIXED, mirroring `2e705a01d` verbatim.** Limb A was confirmed
absent exactly as filed (both predicates already `await` `getCombatContext`). Both twins now
pass the raw bucket value directly as `playerStats` (no `{computedStats}` wrapper):
- `src/services/automation/handlers/spells/greaseAreaSaveHandler.js` — `greaseTargetIsImmune`
  passes `getRuntimeValue(targetName, 'computedStats', campaignName)` directly + explanatory
  comment (mirrors the fixed web twin).
- `src/services/automation/handlers/spells/stinkingCloudHandler.js` — `stinkingCloudTargetImmune`
  likewise; its monster-side `weaknessesAndResistivities.immunities` leg is untouched.
- `greaseAreaSaveHandler.areaSave.test.js` — the :206 WRAPPER-shape pin FLIPPED to the
  raw-bucket call shape, and the old one-test immunity block CONVERTED into the sleet/web pin
  quartet: immune-player-skips (raw-bucket pin + zero prompt/log/write), non-immune-player-
  resolves (prone still lands), null-bucket-resolves (`playerStats: null` passed through),
  monster-with-immunity-bucket-unaffected-by-immunity-leg. A re-introduced wrapper fails the
  call-shape pins.
- `stinkingCloudHandler.areaSave.test.js` — the `objectContaining` immunity pin upgraded to the
  exact raw-bucket call shape + the same four-pin conversion (immune skips / non-immune resolves
  Poisoned / null-bucket / monster leg).
- Dual-ruleset: no twins — both rulesets share these handlers via `expireStaleEffects.js`
  Phases 4/6 (ruleset-agnostic imports), same census as the sleet/web resolution.

**Live two-way verification (test-campaign, dev pair :5173, GM localhost; rig = seeded runtime
lane per the sleet/web resolution; saveDc 40 so EF's +12 DEX / +11 CON saves fail):** seeded
`combatSummary` (DivinationWizard + EvasiveFighter + `Goblin Ctrl`), caster bucket
`_grease_/_stinkingCloud_DivinationWizard` tracking (full handle() shape, `mapName:'test-map'`
— `test-campaign` has NO active map, so `isWithinRange`'s no-active-map leg returns true),
campaign `targetEffects` grease+stinking_cloud rows on the PC and the NPC, EF bucket
`computedStats:{name, immunities:['prone','poisoned']}` (Stinking's consumer rule leg matches
the condition key `'poisoned'` — `automationImmunities.js` `staticImmunityMatches` vs the
handler's `conditionKey:'poisoned'`).
- BEFORE (wrapper shape restored on disk, fresh reload, handlers driven via in-page
  `import('/src/…')`): Grease at the prone-immune PC ARMED `savePrompt-EvasiveFighter-*` +
  ability_use row; failed DC-40 save landed `activeConditions:["prone"]`. Stinking at the same
  PC ARMED the CON prompt and landed `poisoned` + the `no_action_and_bonus_action` block te.
  Control `Goblin Ctrl` correctly took Prone + Poisoned. Defect fully witnessed (14 log rows).
- AFTER (fix on disk, reload, same rig reseeded): BOTH handlers return `null` for the immune
  PC — zero `savePrompt-*` keys, zero new log rows, no conditions (EF bucket stays
  `activeConditions`-absent). The REAL wired seam was then driven honestly (top-level
  `activeCreatureName` POST → mounted-tab echo sweep Phases 4+6): the seam at the immune PC
  armed NOTHING (0 prompt keys, 0 new rows); the seam at the control goblin armed EXACTLY one
  recurring Stinking prompt (its Grease save correctly skipped by the already-prone gate).
  Non-immune sanity post-fix: Grease at `DivinationWizard` (no seeded bucket) armed, failed,
  landed `prone` — unchanged; controls byte-identical.
- Cleanup: browser closed, Admin clear-change-data + clear-log (server back to `{}` / `[]`),
  overlays `[]`, no character FILES touched — 14-file aggregate
  `514ec55f3671ab207833c0e8fdb0a84b` re-verified intact.

**Gates:** touched 2 test files 33/33 → `npx vitest run src/services/automation/handlers/spells`
135 files / 2144 tests → `npm run lint` clean (exit 0) → `node .opencode/plans/no-timers-guard.mjs`
OK (47 benign sites) → FULL SUITE (background-bounded): run 1 `3547 files / 37673 tests`
(baseline 37667 + the 6 new immunity pins, file count identical) with ONE failure in
`PolymorphSelectionModal.focus.test.jsx` (char-sheet modal focus lane, zero diffs this change,
7/7 in isolation); CLEAN RE-RUN 2 re-flaked on a DIFFERENT unrelated modal lane
(`ElementalAttunementModal.phase-flow.test.jsx`, 16/16 in isolation, 173 ms isolated vs 1027 ms
parallel wait) — third run **`Test Files 3547 passed (3547) / Tests 37673 passed (37673) /
EXIT: 0`**. Baseline holds with the new pins added; both run-1/run-2 reds were parallel-run
timing flakes (same family as the WizardStepBasic precedent, 2026-11-23).

**Hydration gap (ticket's "Also owed") — investigated; genuinely an owner design call, NOT
implemented here.** Traced evidence (full write-up in the follow-up file): the real PlayerStats
live ONLY in `App.jsx:732 rulesFactory.getPlayerStats` → `computedCharacters` state, reached by
every working immunity caller as a PASSED/prop roster (`computedStats || character` —
`SetConditionModal.jsx:30`, `useLoggedDiceRollEventHandlers.js:125`, and the turn-seam siblings
`navigationHandlers.js:221`/`sseHandlers.js:157` which resolve stats one line from the very
`expireStaleEffects` calls). Threading `characters` through the sweep into the four handlers is
feasible (it IS in scope at all three sweep call sites) — but it reverses the canonical
bucket-read stats source that `2e705a01d` shipped the SAME DAY (re-pinning its just-live-verified
sleet/web pins and its playbook rig law), and the alternative producers each carry their own
doctrine consequences (server-side stamp persists derived megabyte blobs into change-data + SSE
echoes; an App in-memory seed goes stale until re-entry AND rides every later full-store
character POST to disk anyway). Owner must pick the canonical writer before the pins move a third
time. Filed: `.opencode/plans/bug-zone-save-computedstats-bucket-has-no-producer.md` (OPEN).
