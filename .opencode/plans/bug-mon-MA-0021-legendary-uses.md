# bug-mon-MA-0021 — Aboleth "Legendary Action Uses: 3 (4 in Lair)" — display-only name text, zero economy

## Title
MA-0021 Aboleth · Legendary Action Uses: 3 (4 in Lair) · legendary_actions · other · FAIL (flavor b: unimplemented)

## Overview
The legendary-uses header row is inert plain text. There is no uses counter, no spend mechanic, no regain-at-turn-start economy, and no initiative integration for "immediately after another creature's turn". (Recorded by orchestrator from subagent MA-0021 run evidence; subagent's claimed file did not persist.)

## Expected Behavior
Row description: "Immediately after another creature's turn, the aboleth can expend a use to take one of the following actions. The aboleth regains all expended uses at the start of each of its turns."
monsters.json: uses authored ONLY inside `legendary_actions[0].name` string "Legendary Action Uses: 3 (4 in Lair)" — no count/uses field.

## Actual Behavior
- Data: no count field; "3 (4 in Lair)" is name-text only (name-vs-field drift).
- Code: MonsterCardBody.jsx:29 renders legendary rows as inert `.mc-action` divs. `grep legendary src/ server/` → loot rarity + display row + test fixtures only. Zero initiative integration.
- Live probe: joined Aboleth 1 (init 7); `.mc-overlay` Uses row clickable:false, no dice-link, no spinbutton; click mounted nothing. Next→ walk 15 clicks (Aboleth active twice, round stayed 1): zero legendary prompt/popup/counter change. change-data before/after: zero `legendary` keys.

## Steps to Reproduce
1. localhost:5173 → test-campaign → Encounters → search "Aboleth" → Join Encounter.
2. Initiative → open Aboleth card (.mc-overlay) → click "Legendary Action Uses" row → nothing.
3. Walk Next→ a full round → no legendary prompt/regain; curl /api/campaigns/test-campaign/change-data → no legendary keys.

## Likely Location
Data layer (no count field) + missing subsystem: no consumer in MonsterCardBody.jsx / initiative.jsx / navigationHandlers.js. Whole legendary economy absent app-wide (MV-17 fingerprint — applies to the entire legendary_actions category).

## Notes
- 4-vs-3 lair variant unmodellable (no lair flag consumer).
- Same fingerprint expected for all legendary header rows; verbatim legendary action rows still need per-row probes.
