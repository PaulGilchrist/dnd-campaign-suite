# Movement budget snap is logged + charged but the token is not repositioned

### Summary
With Enforcement `movementBudget` ON, dragging a player token past its remaining
movement correctly triggers the clamp in `usePlayerDragging.js`: it computes a
snapped target, charges the turnState budget, and writes an `enforcement_denied`
log ("Out of movement — snapped to the remaining budget (N ft this move)"). But
the token is **persisted and rendered at the RAW drop cell**, not the snapped
cell — so the creature actually travels farther than its budget allows. The clamp
decides and bills the movement but never applies it to the token position.

### Steps to reproduce
Start from a quiet test-campaign (change-data `{}`, log `[]`).

1. On localhost (`:5173`), select **test-campaign** (verify `.campaign-name` header).
2. Admin → Enforcement: flip the master switch ON (click the **label**, not the
   input — inputs have no aria-label), then check **Movement budget**.
   Disk truth: `GET /api/campaigns/test-campaign/change-data` →
   `enforcement.mode==='on'`, `enforcement.movementBudget===true`.
3. Maps → **Battle Arena** → Open (token-bearing SVG map; `map.players` are
   EvasiveFighter / FeyRanger / AberrantSorcerer).
4. Ensure EvasiveFighter's turn movement budget is EXHAUSTED so any drag must snap
   back to her start cell. Read her start cell, e.g. `(gridX=1, gridY=12)` with
   `GET /api/campaigns/test-campaign/maps/battle-arena` and confirm
   `GET /change-data` → `turnState.EvasiveFighter.movementUsedFeet` equals her
   full speed (30) — remaining budget = 0.
5. Drag her token 2 cells to the right (one grid cell = 40 SVG px; the map CTM
   scale is ~1.0725, origin screen ~ (526,66)): press on her token center, move
   through the two cells, release 2 cells over.
6. Wait ≥ 10 s (cache debounce) and read the authoritative position:
   `GET /api/campaigns/test-campaign/maps/battle-arena?_=<ts>` →
   `players[].name==='EvasiveFighter'` and `GET /change-data` →
   `turnState.EvasiveFighter.movementUsedFeet`, `moveLogs`.

### Expected behavior
Remaining budget is 0 ft, so `resolveMovementBudgetDrop` returns the creature's
start cell `(1,12)` as the clamped target (`usePlayerDragging.js:71-74`) and
`handlePointerUp` writes that target via `setMapData` (`usePlayerDragging.js:261-270`).
The token must **land back on `(1,12)`** (no movement). At a non-zero over-budget
drop the token must land on the snapped cell returned by `snapToBudget`, not the
raw requested cell.

### Actual behavior
- After the 0-ft-remaining drag the token persisted at the RAW destination
  `EvasiveFighter @ (3,12)` — 2 cells = 10 ft of free movement over a zero budget.
- `turnState.EvasiveFighter.movementUsedFeet` stays at its prior value (30).
- The campaign log DOES record the clamp:
  `{ type:'enforcement_denied', creature:'EvasiveFighter', bucket:'movement',
     source:'map-drag', reason:'Out of movement — snapped to the remaining budget (0 ft this move).' }`
  So the enforcement "knows" it snapped to 0 ft, yet the token sits 2 cells away.
- Reproduced a second way earlier in the same session: with a fresh 30 ft budget,
  dragging 8 cells `(1,8)→(9,8)` (= 40 ft) charged `movementUsedFeet:30` and logged
  "snapped to the remaining budget (30 ft this move)", but the token persisted at
  `(9,8)` (the raw 40 ft target), not the clamped `(7,8)`.

The clamp decision, the budget charge, and the audit log all fire; only the token
reposition is missing. Close-but-not-exact: right feature, wrong landing.

### Likely location
`src/components/map/hooks/usePlayerDragging.js` — `handlePointerUp`
(lines 204-275). `resolveMovementBudgetDrop` (43-75) returns the clamped
`{ targetX, targetY, moveCostFeet, budgetActive }` and `handlePointerUp` does
assign `targetX = budget.targetX; targetY = budget.targetY;` then calls
`setMapData(...)` with those values (265-270). Despite that, the authoritative map
JSON keeps the RAW drop cell. Most probable root cause (GUESS, needs code read):
`handlePointerMove` (164-202) already committed the RAW cell to the map's live
`players[]` store during the drag, and the persistence/upload path (SSE sync /
`onChange` save, or a debounced auto-save captured from the pointermove state) races
or overrides `handlePointerUp`'s clamped `setMapData` — so the clamped write never
wins the map-data race and the raw position is what saves. A secondary possibility is
that the snapped `targetX/targetY` in `handlePointerUp` is shadowed or recomputed to
`clampedGridX/clampedGridY` somewhere upstream. Confirm by reading `handlePointerUp`
and the map auto-save seam (e.g. `useMapDrops.js` / Map.jsx `onChange`/persist).

### Suggested fix
First check whether the clamped `targetX/targetY` actually reach `setMapData` at
drop time (add a one-shot console.log of `budget` + final `players[dragging.playerId]`
inside `handlePointerUp`). If they do but the disk still shows raw, the raw position
committed during `handlePointerMove` is being auto-saved on a debounce that fires
after the clamped write — the fix is to defer/suppress persistence until the clamped
drop is resolved (or write the clamped cell through the SAME path pointermove uses,
so the last committed value is the snapped one). If the clamped values do NOT reach
`setMapData`, fix the assignment ordering in `handlePointerUp`.

### Severity
Data integrity risk. The whole point of `movementBudget` enforcement is that a
creature cannot move beyond its remaining speed; the token ending up 10-40 ft past
the budget while the app simultaneously logs that it snapped means enforced movement
limits are cosmetic on the board — players/GMs get a false audit trail (the log
claims a snap that never visually happened) and the persisted map state violates the
speed budget the economy just charged.
