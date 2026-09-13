# bug-mon-MA-0058 — Adult Blue Dragon "Legendary Action Uses: 3 (4 in Lair)" — display-only name text, zero economy

## Title
MA-0058 Adult Blue Dragon · Legendary Action Uses: 3 (4 in Lair) · legendary_actions · other · FAIL (flavor b: unimplemented)

## Overview
Legendary-uses header row is inert plain text in the monster card. No uses counter, no spend mechanic, no regain-at-turn-start economy, no "immediately after another creature's turn" initiative integration. Same MV-17 fingerprint as MA-0021 (Aboleth).

## Expected Behavior
Row: "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns." Uses should be tracked (3, or 4 in lair) and gate the three legendary actions (Cloaked Flight, Sonic Boom, Tail Swipe).

## Actual Behavior
- Data: monsters.json `legendary_actions[0].name` carries "3 (4 in Lair)" as name text; no count/uses field; no lair flag.
- Code: MonsterCardBody routes legendary_actions through the same inert MonsterAction path; no consumers for Cloaked Flight / Sonic Boom / Tail Swipe (grep-zero); no legendary-economy state anywhere in src/server.
- Live probe (test-campaign): joined Adult Blue Dragon 1 (init 18, 212 hp); `.mc-overlay` Uses row = DIV.mc-section, cursor auto, zero interactive elements; forced click → zero new modals/inputs/counter. change-data: no legendary/uses keys.

## Steps to Reproduce
1. localhost:5173 → test-campaign → Encounters → search "Adult Blue Dragon" → tick → Join Encounter.
2. Click dragon to open `.mc-overlay` → click "Legendary Action Uses: 3 (4 in Lair)" row → nothing.
3. curl /api/campaigns/test-campaign/change-data → no legendary economy keys.

## Likely Location
Data layer (name-vs-field drift) + missing subsystem: no uses counter/spend/regain consumer in MonsterCardBody.jsx, initiative navigation, or combat pipeline. Whole legendary economy absent app-wide (MV-17 — applies to entire legendary_actions category).

## Notes
- 4-vs-3 lair variant unmodellable (no lair flag consumer).
- Cleanup: admin clear-change-data + clear-log POSTs (Host: localhost) → 200.
