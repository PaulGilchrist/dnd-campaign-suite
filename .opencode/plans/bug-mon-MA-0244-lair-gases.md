# Bug — MA-0244: Ancient Red Dragon unnamed lair action "Volcanic gases" is inert (no name → unclickable, zero effect)

## Overview
Ancient Red Dragon `lair_actions[2]` (MA-0244) authors a numeric `save_dc: 13`, `save_type: Constitution` and a `save_effect` (poisoned + incapacitated), but the row has **no `name`**. The name-gate in `isLairRowClickable` rejects it, so the row renders statically with a `.` placeholder and no dice-link — GM clicking it produces zero effect and zero log entries. Same nameless-lair family as MA-0221/0222/0231/0232/0233/0242/0243.

## Expected
Row 2 of `ancient-red-dragon.lair_actions` in `public/data/monsters.json`:

> "Volcanic gases form a cloud in a 20-foot-radius sphere centered on a point the dragon can see within 120 feet of it. The sphere spreads around corners, and its area is lightly obscured. It lasts until initiative count 20 on the next round. Each creature that starts its turn in the cloud must succeed on a DC 13 Constitution saving throw or be poisoned until the end of its turn. While poisoned in this way, a creature is incapacitated."

A structured save row (numeric DC + type + save_effect) should be clickable and adjudicate the DC 13 CON save, applying poisoned/incapacitated on failure.

## Actual
- Rendered as `<div class="mc-action"><strong>.</strong> <span>Volcanic gases …</span></div>` — 0 links, 0 buttons.
- Clicking the row: log delta **0** (2→2). No DC 13 CON save prompt, no cloud/zone created, no targetEffects applied.

## Steps to reproduce
1. localhost app → select `test-campaign`.
2. Encounters → search "Ancient Red Dragon" → tick → Join.
3. Open the dragon combat card modal → locate the "Volcanic gases" lair row.
4. Click the row → nothing happens; `/api/campaigns/test-campaign/log` shows zero delta.
5. Control: clicking the live "+17" Rend chip DOES log an attack roll (2→3) — pipeline is healthy.

## Likely Location
- `public/data/monsters.json` — `ancient-red-dragon.lair_actions[2]` missing `name` (keys: description, save_dc, save_type, save_effect only).
- `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable` returns false when `!row.name` (MV-24 nameless-dict gate) → static `<strong>.</strong>` rendering, never routed to the save seam.

## Fix
1. **Data:** add `"name": "Volcanic Gas Cloud"` to `ancient-red-dragon.lair_actions[2]`, mirroring the sibling named lair rows, and keep/normalize `save_effect` to poisoned + incapacitated so the failed-save conditions apply via the MA-0017 condition seam.
2. **Residual (§7):** the "starts its turn in the cloud" turn-start zone save has **no lair seam** — there is no initiative/lair zone engine to re-check creatures entering or starting their turn in the cloud each round. Even after naming, the recurring per-turn save remains GM-advisory; full automation requires a new turn-start zone adjudication seam (new state design, deliberately out of scope of the minimal GM-clicked lair model).

## Cleared
Admin cleared change-data + log after verification; curl confirmed `{}` and `[]`.
