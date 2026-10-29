# Initiative "Clear" converts every monster on the board into an unnamed statless `NPC N` stub (monster rows counted as bare NPCs)

## Summary
The Clear button's NAMED confirm promises "removes all monsters from the board", but `handleClear` rebuilds the board via `clearCombat(characters, numOfNpc)` where `numOfNpc` counts ALL `type:'npc'` creatures — and Encounter-Builder-joined monsters are `type:'npc'`. So clearing a board that had 1 Goblin leaves a fresh, nameless, statless `NPC 1` (AC 10, 10 HP) on both the client and the server board; clearing Goblin×3 + Bandit would leave `NPC 1..NPC 4`. Bare `+ NPC` placeholder rows are presumably meant to survive Clear (that appears to be the intent of passing numOfNpc); the defect is that MONSTER rows are counted into that number and re-materialize as anonymous NPCs.

## Steps to reproduce
1. In test-campaign (localhost), Encounters view → search `Goblin` → check Goblin (CR 0.25) → `Join Encounter`. Board = 12 PCs + Goblin.
2. Initiative view → click `Clear` → accept the confirm `Clear combat status for all creatures? This resets initiative and removes all monsters from the board. This action is irreversible.`
3. Observe the board: 12 PCs + **`NPC 1`** (nameless, no image, 10/10 HP, AC 10).
4. `GET /api/campaigns/test-campaign/combatSummary` → 13 creatures: 12 players + `{name:"NPC 1", type:"npc", ac:10, maxHp:10, currentHp:10}` — no `monsterIndex` (the Goblin was not preserved, it was TRANSFORMED).
5. Control: with zero npc-type creatures on the board, Clear again → board stays exactly 12 PCs (numOfNpc = 0), confirming the stubs come from the monster count.

Live-proven 2026-10-29 run AC (single Goblin on board → exactly one `NPC 1` after Clear; also corroborates run-T 2026-10-28's note "Goblin x2 join, Clear, then both NPC placeholders removed via .npc-remove-btn" — that prior session hit the same symptom and misread the stubs as +NPC additions).

## Expected behavior
After accepting the named confirm, no trace of the monsters should remain on the board: 12 PCs only (any bare `NPC N` placeholders that existed before Clear may survive, but a monster must never resurrect as an NPC stub).

## Actual behavior
The Goblin vanished and an anonymous `NPC 1` took its place on client AND server. The stub pollutes every card's target dropdown, the +NPC numbering (`addNpc` will create `NPC 2` next), and the generator/loot filters, and silently contradicts the confirm copy.

## Likely location
Confident (code read at HEAD 626ea974d + live repro):
- `src/components/initiative/Initiative.jsx:370` — `numOfNpc: creaturesOrEmpty(combatSummary).filter(c => c.type === 'npc').length` (EB monsters carry `type:'npc'`).
- `src/components/initiative/createCreatureHandlers.js:158` — `clearCombat(characters, numOfNpc, ...)`.
- `src/services/encounters/initiativeService.js:14-38/176` — `setupCreatures` blindly pushes `NPC 1..N`.

## Suggested fix
Count only true bare placeholders, e.g. `c.type === 'npc' && !c.monsterIndex && /^NPC \d+$/.test(c.name)` in Initiative.jsx:370 — or better, have `clearCombat` receive the existing bare-NPC rows themselves (preserving their names/HP) instead of a count (a 7-HP damaged `NPC 2` currently gets reborn as a fresh 10-HP `NPC 1` + `NPC 2` pair mismatch too). Add a pin: Clear with 1 monster → creatures.length === characters.length.

## Severity
Data integrity risk — junk creature rows persist into `combatSummary` after an operation whose own confirm says they're gone; downstream consumers (target lists, initiative navigation, loot/auto-rewards roster, +NPC numbering) all ingest the phantom.

## Provenance note
Run Z (2026-10-29) already OBSERVED the residue ("accept leg removes monsters + re-seeds 12 PC skeletons + `NPC 1:npc:10` placeholder per known semantics") but labelled it known semantics without documenting the intent anywhere. Preserving genuinely bare `+ NPC` placeholders may well be by design (hence `numOfNpc`); re-materializing MONSTERS as anonymous NPC stubs is not covered by any confirm copy and contradicts "removes all monsters". If the owner rules the whole behavior intentional, the minimal honest fix is the confirm copy + a name/HP-preserving carry-over of the bare-NPC rows; otherwise the filter fix above.

## Summary
Clearing a board that held EB-joined monsters left anonymous `NPC N` statless stubs on both client and server (`numOfNpc` counted every `type:'npc'` creature, and EB monsters ARE `type:'npc'`). Fixed by carrying over ONLY untouched `+ NPC` placeholders: a new `isBareNpcPlaceholder` predicate in `initiativeService.js` (`type==='npc'` + no `monsterIndex` + exact `NPC N` name) now filters the Clear carry-over count. Monsters, summons, and renamed NPCs are permanently removed by Clear, exactly as the confirm copy promises.

## Resolution
FIXED 2026-10-29 (subagent run, HEAD on top of 26ffb4aa5/3fe2031dc).

**Root cause** — exactly as diagnosed in the bug file: `Initiative.jsx` computed `numOfNpc` as `creaturesOrEmpty(combatSummary).filter(c => c.type === 'npc').length`; Encounter-Builder-joined monsters carry `type:'npc'` (plus `monsterIndex`), so `clearCombat(characters, numOfNpc, …)` → `setupCreatures` blindly re-pushed `NPC 1..N` fresh 10-HP/AC-10 stubs for every monster that was on the board.

**Fix chosen: the minimal filter fix** (per orchestrator guidance). The name/HP-preserving carry-over variant was rejected as not "trivially clean": it changes the `clearCombat(characters, npcCount, getName)` signature pinned by verbatim-byte tests in `initiativeService.test.js` plus the prop chain through `Initiative.jsx`/`createCreatureHandlers.js` and ~5 more component-test mocks — disproportionate churn for the reported defect. Bare-placeholder semantics are pinned instead: untouched `NPC N` rows still survive Clear (as fresh defaults, same as before); everything monster-shaped is gone.

**Files changed:**
- `src/services/encounters/initiativeService.js` — NEW exported predicate `isBareNpcPlaceholder(creature)` (`type === 'npc' && !monsterIndex && /^NPC \d+$/.test(name)`), the single source of truth for "untouched +NPC placeholder" (sits beside `addNpc`, which owns the `NPC N` naming).
- `src/components/initiative/Initiative.jsx` — `numOfNpc` now counts `.filter(isBareNpcPlaceholder)` (was `.filter(c => c.type === 'npc')`).
- `src/services/encounters/initiativeService.test.js` — regression pins: `isBareNpcPlaceholder` accepts only bare placeholders (rejects EB monster/`Goblin 2`/summon/renamed NPC/wrong-case name/non-npc type/player/nameless); `clearCombat` with an EB-monster+summon board carries 0 (players-only re-seed).
- `src/components/initiative/initiative.test.jsx` — component pins: `clearCombat` mock is now count-faithful (pushes `NPC 1..N`); existing Clear test re-pinned to count 0 for the monster-shaped fixture (`Goblin` without monsterIndex is still monster-shaped → removed); NEW test: board with EB Goblin (`monsterIndex:'goblin'`) + bare `NPC 1` → Clear → `clearCombat(characters, 1)` and cards = players + exactly `NPC 1`, no monster stub.
- Mock-factory parity (playbook §47 — every `vi.mock` of a heavily-mocked util must carry new exports): `isBareNpcPlaceholder` stub added to `initiative.localhost-gate`, `initiative-init-rolled-handler`, `initiative-callbacks`, `initiative.overlays`, `initiative.conditions-live-sync`, `createCreatureHandlers.test` mocks (all render `Initiative.jsx`, which imports the new named export).

**Logging:** the Clear path previously logged no campaign row (storage.set + session-phase change only); behavior kept consistent — no new log row added by this fix.

**Live verification (test-campaign only, :5173):**
- REPRO pre-fix: EB Join Goblin (cs showed `Goblin:npc:monsterIndex 'goblin'` + 12 PCs) → Initiative → Clear → accepted the verbatim named confirm → client board 12 PCs + `NPC 1`, server `GET /combatSummary` = 13 creatures incl. `NPC 1:npc:ac10:hp10` with NO monsterIndex. Bug confirmed exactly as filed.
- POST-fix: removed the phantom stub, re-joined Goblin → Clear → server + client boards = **exactly 12 PCs, zero non-players, round 1** ✓.
- Sanity leg (pinned semantics): bare `+ NPC` + EB Goblin on board → Clear → `NPC 1` (AC10/HP10) survives, Goblin gone, no crash, zero console errors ✓.
- Cleanup: NPC removed via card ×, Admin `clear-change-data` + `clear-log` POSTed (200/200), tab closed, quiet two-pass GET-verified `change-data {}` / `log []` / `combatSummary null`.

**Tests/lint:** `initiativeService.test.js` 43/43 → `src/components/initiative/` 510/510 → `src/services/encounters/` 1157/1157 → `npm run lint` clean (zero warnings) → full `npm run test:run`: **2914 files / 32,191 passed, 3 expected-fail, zero failures**.

