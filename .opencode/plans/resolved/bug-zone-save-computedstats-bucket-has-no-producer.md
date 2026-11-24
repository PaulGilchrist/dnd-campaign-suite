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

## Resolution (2026-11-23/24 fix-run — OPTION A LANDED per owner call)

Owner ratified the ticket's traced **Option A: thread real stats through the sweep callers**.
This deliberately reverses the same-day bucket-read canonicalization of `2e705a01d`: the four
`getRuntimeValue(targetName, 'computedStats', …)` reads are **DELETED** (no dual-read, no
fallback — one canonical shape, owner no-legacy doctrine), and their pins + the playbook
zone-immunity rig law were re-pinned/rewritten IN PLACE in this same change.

### Implementation (exactly the ticket's Option A trace)

- `src/services/rules/effects/expireStaleEffects.js` — `expireStaleEffects(campaignName,
  overrideActiveName, characters)`; new module-local `resolveTargetStats(targetName, characters)`
  = `characters.find(ch => ch.name === targetName) → computedStats || character` (the
  `applyTurnStartGate` sibling idiom at `navigationHandlers.js:221-222`). Phase 3 passes
  `resolveTargetStats(teTargetName, characters)` per sleet te; `processZoneTurnStartSaves` takes
  `characters` and passes `resolveTargetStats(activeName, characters)` as the 5th arg of
  `processSave` (Phases 4/5/6).
- The four handlers gain the 5th param and consume it AS the stats object; the bucket read is
  removed: `processGreaseAreaSave(caster, target, campaign, _map, targetStats)` →
  `greaseTargetIsImmune(…, targetStats)`; `processSleetStormAreaSave(…, targetStats)` →
  `shouldSkipSleetAreaSave(…, tracking, targetStats)`; `processWebAreaSave(…, targetStats)` →
  `webTargetIsImmune(target, campaign, targetStats)`; `processStinkingCloudAreaSave(…, targetStats)`
  → `stinkingCloudTargetImmune(targetCreature, target, campaign, targetStats)`. Monster/NPC legs
  byte-identical (grease/sleet/web keep the awaited `getCombatContext` type gate; stinking keeps
  the cs-row `weaknessesAndResistivities.immunities:['Poison']` first leg). `targetStats` arrives
  `undefined` for roster-miss targets (monsters, summons) — `playerIsImmuneToCondition`'s own
  `!playerStats` guard answers false, so those legs are skip-semantics-unchanged.
- Callers (the ONLY three production call sites, all with `characters` already in scope):
  `navigationHandlers.js:359` + `:451` → `expireStaleEffects(campaignName, newActiveName, characters)`;
  `sseHandlers.js:212` → `expireStaleEffects(campaignName, newActive, characters)`. No other
  `expireStaleEffects` callers exist (grep-verified: the remaining matches are test mocks).
- Dual-ruleset: no twins — both rulesets share the one `expireStaleEffects` dispatch table (confirmed).
- Grep proof: `getRuntimeValue(…'computedStats'…)` is now **ZERO repo-wide** in `src` (the bucket
  key has neither producer nor consumer; the generic `seedCharServerKeys` verbatim-seed lane in
  `App.jsx` stays untouched — it is not a `computedStats` special case).

### Live BEFORE (production gap witnessed, zero bucket seeding)

Rig fixture: **`FixtureLandDruid`** created END-TO-END via the in-app character wizard (2024
lv20 Druid / Circle of the Land — the only wizard-reachable lane whose rules derivation carries
a zone-family condition immunity; registered in `docs/test-character-registry.json`, KEEP —
it is now the permanent immunity fixture). Fiber-proved: sheet `__reactFiber$` walk →
`memoizedProps.playerStats.immunities === ['poisoned']` (Nature's Ward `land_resistance` merged
by `rulesFactory.js:170-176`, land-type-independent). Seeded ONLY zone lanes (caster tracking
buckets, campaign `targetEffects` grease+stinking at `saveDc:40`, hand-rolled 4-row
combatSummary). Drove the REAL turn seam: `POST /api/campaigns/test-campaign/activeCreatureName`
echo sweep on the mounted Initiative tab.

- BEFORE witness (immune PC at its own seam): `savePrompt-FixtureLandDruid-2708520a-e804-4b68-
  9921-b738c8ca1701` armed CON DC-40 + row `ability_use | CelestialWarlock | "FixtureLandDruid
  starts its turn in Stinking Cloud and must make a CON save (DC 40) or become Poisoned until the
  end of the current turn (can't take an Action or Bonus Action)."` → adjudicated FAIL
  (`Math.random→0`, `CON +2 +5 = +7`, total 8 vs 40) → `save_result | FixtureLandDruid |
  "FixtureLandDruid failed CON save (DC 40, rolled 1 +7 = 8)"` + `save_result | CelestialWarlock |
  save-stinking-cloud | "FixtureLandDruid failed its turn-start CON save (DC 40) against Stinking
  Cloud and is Poisoned until the end of the current turn."` + `condition` row + bucket
  `activeConditions: ['poisoned','prone']`. The documented immunity never reached the gate.
- Controls BEFORE (captured for byte-identity): EvasiveFighter (non-immune PC) — stinking CON
  prompt (`rolled 1 +11 = 12` fail) + grease DEX prompt (`rolled 1 +12 = 13` fail) + Poisoned/
  Prone landing; Goblin 1 (monster leg, cs-row poison check) — CON prompt (`rolled 1 = 1` fail).

### Live AFTER (same rig, same real-immunity character, same seam — STILL zero seeding)

Full-page reload on the new :5173 source, admin-clear between phases, identical re-seed:

- Immune PC seam: Stinking Cloud **SILENTLY SKIPPED** — zero `savePrompt-*` keys, zero log rows,
  zero writes for `FixtureLandDruid` from the Phase-4 leg (only the Grease DEX prompt armed from
  Phase 6, adjudicated `rolled 1 +6 = 7` fail → `activeConditions: ['prone']` only — no `'poisoned'`;
  correct, since no rule anywhere grants Prone immunity, so grease is a second honest control).
- EvasiveFighter + Goblin 1 controls: byte-identical prompt copy, roll totals (`+11 = 12`,
  `+12 = 13`, `1 = 1`), roll types (`save-stinking-cloud`/`save-grease`) and condition rows to
  BEFORE.
- Exit cleanup: closed-tab admin clears — `change-data {} + log [] + overlays []` GET-verified
  (the curl-seeded zones live in the runtime lane, cleared with the store; the spell-overlay
  store was already `[]`).

### Pins moved / added

- Handler areaSave quartet re-pinned from the bucket-read contract to the PASSED-stats contract
  (defect-incompatible: the gate call-shape pins take the threaded object; added read censuses
  assert no `computedStats` key is EVER read; the old null-bucket pins became roster-miss
  `undefined`-param pins; monster-leg pins now thread an immunity-carrying arg to prove the
  TYPE gate, not the stats, is the discriminator): `greaseAreaSaveHandler.areaSave.test.js`,
  `sleetStormHandler.areaSave.test.js`, `stinkingCloudHandler.areaSave.test.js`,
  `webAreaSaveHandler.areaSave.test.js` (+ QUARTET/PAIR header re-words).
- Sweep dispatch pins 4-arg → 5-arg plus a per-family threading pin proving
  `characters.find → computedStats` lands as the 5th arg: `expireStaleEffects.test.js`,
  `expireStaleEffects.web.test.js`, `expireStaleEffects.grease.test.js`,
  `expirations_expireStaleEffects.test.js`.
- NEW end-to-end-family file `src/services/rules/effects/expireStaleEffects.immunity-threading.test.js`:
  REAL `expireStaleEffects` + REAL zone handlers + REAL `playerIsImmuneToCondition` (deliberately
  unmocked) — one sleet sweep over a roster carrying a prone-immune player arms NOTHING for it
  (zero prompt calls / log rows / writes) while the non-immune control arms; plus the
  roster-miss-still-arms leg. This is the rig the ticket says was missing: it pins production
  FEEDING the gate, not a harness seeding it.
- Caller pins extended with the threaded 3rd arg: `navigationHandlers.test.jsx` (6),
  `navigationHandlers.second-turn.test.js` (twin-row skip made shape-proof),
  `sseHandlers-main.test.jsx` (2), `sseHandlers.zone-expiry-dedupe.test.jsx` (5),
  `sseHandlers.malformed-active-echo.test.jsx`, `sseHandlers.turn-start-gm-ownership.test.jsx`,
  `initiative-callbacks.test.jsx`.
- Docs: `docs/test-setup-playbook.md` Zone-save immunity rig law rewritten IN PLACE (immunity
  rides the passed PlayerStats; the bucket-seed rig is DEAD and replaced by the
  real-immunity-fixture rig; limb-B addendum raw-bucket wording corrected in place);
  `docs/test-character-registry.json` gains `fixture_2024_FixtureLandDruid`; `docs/app-exploration.md`
  baseline updated to the 15-char roster/aggregate.
- Aggregate note: the added fixture file moves the char-file digest-of-digests FROM 14-char
  `514ec55f3671ab207833c0e8fdb0a84b` TO 15-char `9c851a53c10927d7346d27e8d30cb138`
  (FixtureLandDruid.json md5 `e4f00d7c3633b4650b93e22641e5b46d`; re-proved at this run's exit).
  The live pins updated in place: `docs/app-exploration.md` Baseline Fingerprints and the
  `docs/test-setup-playbook.md` roster-moves-the-pin law bullet. Historical per-run session
  notes naming `514ec55f…` remain valid as evidence (registry convention — they are past
  observations, not forward pins).
- Roster-consumer pins: the permanent fixture file also moves the disk-roster counts the
  AI-authoring lanes pin — `server/services/ai/authoring/party.test.js` (`party.length`
  14 → 15) and `server/services/ai/authoring/storyBible.test.js` (`partyLevels.size`
  14 → 15) re-pinned with the same fixture-era comment precedent (d709198ef note).
