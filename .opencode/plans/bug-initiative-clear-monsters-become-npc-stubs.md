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
