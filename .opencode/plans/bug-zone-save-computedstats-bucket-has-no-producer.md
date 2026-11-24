# Bug: no production lane WRITES a character's `computedStats` runtime bucket — the whole zone-save family's immunity gates stay data-starved for REAL PCs

## Summary

The four recurring zone-save handlers (Grease/Sleet Storm/Stinking Cloud/Web) gate player
condition immunities through `playerIsImmuneToCondition` reading the target's runtime-store
`computedStats` bucket — `greaseAreaSaveHandler.js:147`, `sleetStormHandler.js:296`,
`webAreaSaveHandler.js:257`, `stinkingCloudHandler.js:87` (all four pass the RAW bucket as the
stats object since the limb-B fixes: `resolved/bug-sleet-web-immunity-predicates-never-fire.md`
2026-11-23 and `resolved/bug-grease-stinking-zone-save-immunity-wrapper-inert.md` 2026-11-23).
But NO production lane ever writes that bucket: a repo-wide grep for the `'computedStats'`
runtime key finds exactly those four READERS and zero writers (`seedCharServerKeys`/
`App.jsx:427` merely seeds whatever the SERVER change-data bucket already holds — and nothing
POSTs `computedStats` either). Consequence: for real player characters the gate always
evaluates against `null` (immune-skips never fire), and immunity only demonstrably works when
a harness seeds the bucket (both fix verifications did exactly that). The gates are now
structurally correct; they are missing their data source.

## Steps to reproduce

1. Live (test-campaign rig, playbook §"Zone-save immunity rig"): mount Initiative, GET
   change-data — no character bucket carries `computedStats`; the bucket reads inside the four
   handlers' immunity predicates all return `null` even mid-campaign with characters loaded.
2. Give a real roster character a rules-immunity (e.g. a race/feature granting Prone immunity
   flowing through `rulesFactory.getPlayerStats` into `immunities`/`allFeatures`), walk a
   Grease/Stinking zone seam — the PC still saves and takes the condition, because the gate
   never sees the computed stats (it reads the bucket, not the rules engine).

## Expected behavior

A real, rules-derived immunity (the same data every working caller reads:
`characters.find(...) → character.computedStats || character`) reaches the zone-save gates, so
immune PCs skip recurring zone saves WITHOUT harness seeding.

## Actual behavior

`getRuntimeValue(targetName, 'computedStats', campaignName)` is `null` for every real character
on every client — the gate's `!playerStats` leg answers false; immune PCs save and get the
condition.

## Likely location

- Readers (the only four): `src/services/automation/handlers/spells/{greaseAreaSaveHandler.js:147, sleetStormHandler.js:296, webAreaSaveHandler.js:257, stinkingCloudHandler.js:87}`
- The real PlayerStats source: `src/App.jsx:732` `rulesFactory.getPlayerStats` →
  `computedCharacters` React state (`App.jsx:704`), delivered ONLY as the `characters` prop.
  No service-side registry/cache holds it (`getCombatSummary`'s cache carries combatSummary
  rows only — player rows are feature-less stubs with no immunities).

## Traced options (fix-run 2026-11-23 investigation — OWNER DESIGN CALL on which writer wins)

**Option A — thread stats through the sweep (the sibling-automation pattern).** Every working
`playerIsImmuneToCondition` caller resolves the roster at call time and PASSES stats:
`SetConditionModal.jsx:30-35` (`characters?.find(...) → computedStats || character`),
`useLoggedDiceRollEventHandlers.js:125-127` (same idiom via `charactersRef`), and — closest of
all — the turn-seam siblings in the SAME files as the zone sweep callers:
`navigationHandlers.js:221-222` and `sseHandlers.js:157-158` already do
`characters.find(...) → applyTurnStartEffects(newActive, stats, campaignName, characters)` one
line before/after calling `expireStaleEffects(campaignName, newActive)`
(`navigationHandlers.js:359/:451`, `sseHandlers.js:212` — `characters` IS in scope at all three
call sites). Implementing: `expireStaleEffects(campaign, active, characters)` → resolve per
target → `processXxxAreaSave(caster, target, campaign, map, targetStats)` → predicate uses the
passed stats and the bucket read is DELETED (one canonical shape). Cost: 4 handler signatures +
`expireStaleEffects` + re-pinning ~9 test files — INCLUDING the sleet/web `areaSave` pins that
shipped HOURS earlier (`2e705a01d`) deliberately pinning the bucket-read as the zone lanes'
stats source, plus the playbook's zone-immunity rig law ("Immunity seeds ride the character
bucket `computedStats` key"). That reverses a same-day canonical decision → owner call, not a
mechanical fix.

**Option B — give the bucket a producer.**
- B1 server-side stamp at character load (persist every character's full derived PlayerStats in
  change-data): derived data on disk + SSE-broadcast megabyte payloads; the rules engine output
  is recomputable state, never canonical. Conflicts with the server-first/single-source doctrine.
- B2 client in-memory seed alongside `seedCharServerKeys`/`seedTrackedResources`
  (`App.jsx:427/:454`, seeded from `computedCharacters`): cheap, but (a) the seed effect fires
  once per campaign entry (`seededCampaignRef` gate `App.jsx:766`) so the stamp goes STALE on
  level-up/feature edits until re-entry, and (b) `setRuntimeValue` POSTs
  `Object.fromEntries(store)` — once `computedStats` lives in the store, EVERY later
  character-bucket write persists the full derived blob to change-data and echoes it to every
  tab anyway. Both halves are hygiene landmines → owner call.

No third lane exists: service code cannot reach `computedCharacters` prop-less (verified: no
module-level character registry anywhere in `src/services`).

## Suggested fix

Owner picks A vs B (A keeps everything memory-local and mirrors the nearest sibling automation;
B keeps the handlers' call contract frozen and needs a freshness + payload policy). Then flip
the four gates' data source to the winner and pin it end-to-end with a REAL immune roster
character (a fixture seed character carrying `immunities` through `getPlayerStats`), not a
bucket seed — the bucket-seed rig only proves the gate consumes the bucket, never that
production feeds it.

## Severity

Adjudication correctness (data-starved limb of the class): with the wrapper/await limbs fixed,
documented player immunities still never skip Grease/Sleet/Stinking/Web recurring zone saves
for real characters — the skip is live-unreachable until this producer lands.
