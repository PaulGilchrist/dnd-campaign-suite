# Movement-budget engine caps every mover at 30 ft — sheet speed (feat/mount bonuses) and monster speed are never threaded to the map drag lane

## Summary

With enforcement `movementBudget` on, the token-drag budget resolves the mover's speed from `player.speedFeet` on the map token, but nothing in the map layer ever sets `speedFeet` on tokens — so every mover (players, monsters, NPCs) is capped at `DEFAULT_SPEED_FEET = 30` regardless of actual sheet speed. Meanwhile the Initiative HEADER economy strip resolves real sheet speed, so the same creature is shown "30/40 ft — 10 ft remaining" while a 10-ft drag is refused as out of movement.

## Steps to reproduce

Fixture-surgery variant (sanctioned): temporarily grant the 2024 **Speedy** feat (+10 ft speed) to `EvasiveFighter.json` `feats[]`, reload, restore at exit.

1. In test-campaign, `POST /api/campaigns/test-campaign/enforcement {value:{mode:'on',opportunityAttacks:true,actionEconomy:true,movementBudget:true}}`; select the campaign; EB-join Goblin/Wolf/Gazer; hand-board via full-store `combatSummary` POST; sandbox map created and activated with EvasiveFighter token at (6,4).
2. Give EF a fresh budget: `POST /turnState {value:{}}` (or delete the key) and let the mirror settle ~3.5 s.
3. Open Initiative: EF's **card** economy strip reads `... 30/30 ft`; with `activeCreatureName=EvasiveFighter` the **header** strip reads `EvasiveFighter|...|30/40 ft` (true sheet speed 40 after Speedy — the +10 derives into `computedStats.speed`).
4. On the active map, trusted-drag EF (cell-stepped mouse drags):
   - From 30/30 used: a 2-cell (10 ft) drag — the header says 10 ft remain — is refused: sticky toast "EvasiveFighter cannot move — no movement left this turn." + `enforcement_denied` bucket:movement row "(0 ft this move)."
   - With a fresh budget (used 0, sheet speed 40): a 7-cell (35 ft) drag CLAMPS at 30 ft — lands after 6 cells, toast "EvasiveFighter snapped back to 30 ft of movement." + turnState `movementUsedFeet:30`.

## Expected behavior

The movement budget ceiling for a mover equals its derived game speed (sheet `computedStats.speed` for players — the same number the Initiative header strip already displays and the same number a monster's stat block authors, e.g. Wolf = 40 ft). A 40-ft creature gets 40 ft of budget per turn; displays and engine agree.

## Actual behavior

- Drag lane: every mover is capped at 30 ft even when sheet speed is 40 — legal movement is silently refused/clamped by enforcement.
- Per-card `TurnEconomyStrip` denominator: always 30 for every creature type. Witnessed live: Wolf card strip "0/30 ft" (actual speed 40), EF card strip "30/30 ft" while the header strip beside the same board reads "30/40 ft".
- Header strip alone is honest (looks up `characters.computedStats.speed`) — which is what makes the divergence visible and provable on one screen.

## Likely location

Confident (code read + live differential):

- `src/components/map/hooks/usePlayerDragging.js:52` and `:134` — `Number(player.speedFeet) > 0 ? Number(player.speedFeet) : DEFAULT_SPEED_FEET`; `src/components/map/hooks/useSelectMove.js:57` same pattern.
- `src/components/map/Map.jsx:315` passes raw `mapData` to `usePlayerDragging`; map player tokens carry only `{id,name,gridX,gridY}` (owner fixture battle-arena.json) — grep `speedFeet[:=]` app-wide finds ZERO producers that ever stamp it on a token, so the ternary always falls to 30.
- `src/components/initiative/CreatureCard.jsx:671` passes `speedFeet={creature.speed}` — combatSummary rows have no `speed` field for players (mount-merged keys: name/type/initiative/armorClass/maxHitPoints/currentHp/targetName/concentration) NOR for EB-joined monsters (join writes no speed key — verified live GET). Only `Initiative.jsx:799` (header) resolves `characters.find(...).computedStats.speed`.

## Suggested fix

Resolve speed once at the map layer from the same source the header strip uses: when building/annotating players for `usePlayerDragging`/`useSelectMove` (Map.jsx already has `characters` in scope), stamp `speedFeet` from `computedStats.speed` (fallback `speed`, fallback 30). For monsters, either thread the bestiary `speed` through the EB join into the cs row (and use it for both the card strip and, when NPC-token dragging grows a budget, the drag lane) or resolve from `monsters.json` by name. Also pass the resolved speed to `CreatureCard`'s `TurnEconomyStrip` (the `effectSubjectName`-resolved character is already available there). Fix run should keep the header lane bytes untouched and pin: Speedy-40 mover gets 40 ft budget; card denominator equals header denominator for the same creature.

## Severity

Broken feature (enforcement correctness): the L5 movementBudget gate denies legal game movement for every creature faster than 30 ft (Speedy feat, mounts, many monsters), while simultaneously the per-card readout misreports the budget (data-honesty of the readout). Display + engine divergence witnessed live on one screen.
