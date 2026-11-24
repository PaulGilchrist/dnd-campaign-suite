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
