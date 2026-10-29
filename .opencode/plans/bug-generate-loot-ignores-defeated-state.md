# Loot panel "Generate loot from defeated monsters" counts XP (and awards it) for monsters that are fully ALIVE — no defeated-state filter exists anywhere in the lane

## Summary
The Generate Loot button's own title promises "Generate loot from defeated monsters in combat", but neither `generateLootFromCombatSummary` nor its hook/caller ever filters by HP/death state: EVERY `monsterIndex` creature on the initiative board contributes its full XP and loot lines. A live, unharmed monster therefore produces an arming "Award Loot" affordance, and awarding writes XP into every party member's runtime bucket from a combat that never happened.

## Steps to reproduce
1. In test-campaign (localhost), Encounters view → search `Goblin` → check Goblin (CR 0.25) → `Join Encounter`. Board = 12 PCs + Goblin at 7/7 HP (untouched).
2. Initiative view → scroll to the Loot section → click `Generate Loot` (title: "Generate loot from defeated monsters in combat").
3. Observe: textarea `No loot for these monsters` AND `Encounter XP: 50 total · 4 per character`; the `Award Loot` button renders (the XP block + `lootTextValue.length > 0` gate both pass).
4. Verify the Goblin's card still reads HP 7 (`input[aria-label="Goblin current HP"]` → "7").
5. Control A (KO leg): set the Goblin's HP to 0 (typed −3 clamps to 0, logs the `hp_change` death row), press Generate again → output is BYTE-IDENTICAL (`No loot for these monsters` / `XP: 50 total · 4 per character`) — alive vs dead is unobservable to the generator.
6. Control B (empty leg): Clear the board first, then Generate → no textarea, no XP line at all (the honest "nothing to loot" face exists and is what a live monster should produce).
7. (Would-be damage) With a live monster generating, clicking Award Loot POSTs the `loot` + `encounter/loot_awarded` rows and adds 4 xp to all 12 PC runtime keys — the award machine itself was walked live this run (see notes) and only differed by the goblin being dead at that moment; the state it consumes is identical while alive.

Live-proven 2026-10-29 run AC (single live Goblin 7/7 → 50 XP + awardable; KO → identical output).

## Expected behavior
Monsters at HP > 0 contribute nothing: with only living monsters on the board, Generate should produce the same empty face as Control B (or at minimum exclude the live creatures from XP and loot; the label "from defeated monsters" is the contract).

## Actual behavior
Living monsters' XP/loot are counted and awardable exactly as if slain. `xpPerCharacter` math is otherwise exact (50 XP CR-0.25 goblin, floor(50/12)=4).

## Likely location
Confident (code read at HEAD 626ea974d):
- `src/services/items/lootGenerator.js:424-479` `generateLootFromCombatSummary` — filters only summoned-by-PC creatures (`:432-446`); no `currentHp`/`isUnconscious`/`defeated` predicate anywhere; counts `monsterIndex` creatures regardless of HP.
- `src/components/initiative/Initiative.jsx:447` — passes the raw `combatSummary` to `useLootHandlers` (no caller-side filtering).
- `src/components/initiative/useLootHandlers.js:17-43` → calls it directly.

## Suggested fix
In `generateLootFromCombatSummary`, exclude creatures that are not defeated, e.g. keep only `(creature.currentHp ?? 0) <= 0` (mirror whatever death flag the board uses — `isUnconscious`/threshold set by the GM-HP clamp lane) before building `monsterCounts`; add a generator unit pin: live monster → `{lootEntries: [], totalEncounterXp: 0}`. If "count everything on the board" is actually the intended GM shortcut, then the button title/tooltip copy is wrong instead — but the title + "Generate loot from defeated monsters" wording plus the empty-board face make the defeated filter the stated contract.

## Severity
Broken feature (labelled-contract violation with durable side effects) — awarding XP for unslain monsters writes lasting character progression (`xp` runtime keys) and `loot`/`loot_awarded` log rows; the UI's own affordance text invites the mis-grant.
