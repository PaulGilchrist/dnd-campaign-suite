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

## Resolution (2026-10-25, fixed)

**FIX: FIXED.**

### What was actually wrong
Confirmed the bug file's persistence-race family, refined the diagnosis:
`handlePointerMove` commits RAW ghost cells into live `mapData` throughout the
drag (that is by design, for fog preview + token-follow), and when
`movementBudget` is on there is no budget constraint on that live lane.
At drop, `Map.jsx:329` `handleToolPointerUp` runs `flushSave()` **before**
`handlePointerUp(e)` — so the pending autosave snapshot (the RAW mid-drag cell,
captured by the loader effect at the last pointermove) is PUT to disk first.
The server then broadcasts that snapshot back to the sender
(`server/routes/maps.js:232 publish('map-data-…')`), and `useSSESync`'s
merge **overwrites the clamped pointerUp commit** a few ms after it lands —
the debounce timer resets to the RAW payload and re-persists it. Live proof
(captured fetch ledger): two PUTs, both `ef:[9,8]` — the RAW cell at drop and
the RAW cell again at +1019 ms; the clamped `(7,8)` PUT never fired. The
`useSSEEqualityGuard` is loop-prevention (compares to the last *SSE-applied*
value), not staleness protection, so it happily re-applied the stale echo.

### The fix (kill the race at the source — RAW never enters mapData)
Mirrors the established in-handler pattern (walkable-region ghost gating for
fog/walls): when the budget lane is active, the live ghost is additionally
pinned to the cells the creature can still pay for.

- `src/services/combat/movementBudget.js` — new export
  `reachableWithinBudget({ from, obstacles, terrain, gridSize, budgetFeet })`:
  the `"x,y"` cell set of the shared `traverseGrid` Dijkstra within budget
  (same cost model `snapToBudget`/`clampMovementDrop` already use).
- `src/components/map/hooks/usePlayerDragging.js` — `pressBudgetRegion()`
  helper computes that set at press time (enforcement `mode:'on'` +
  `movementBudget` + not GM Shift-unconstrained; `null` ⇒ lane off);
  stored on the drag state as `budgetReachable`; `handlePointerMove`'s
  validity predicate intersects it with `reachable` (over-budget cells
  refuse the ghost commit exactly like wall cells — same `drag-invalid`
  red feedback, so enforcement is now *visible* mid-drag, not just
  logged). `pointerUp` stays untouched: `resolveMovementBudgetDrop`
  remains the billing/logging authority, `finalizePlayerMove` charges
  `clamped.costFeet`, and `snapToBudget` cells are a subset of the same
  same-budget BFS region, so every pointerUp clamped write is inside the
  pinned region too. No persistence lane (mid-drag debounce, up-flush,
  leave-flush, SSE echo) can now carry an over-budget player cell.
  Enforcement off / no campaign / Shift bypass ⇒ `budgetReachable` null ⇒
  byte-identical pre-L5 lane (L1–4 guarantee, pinned by test).
- Dual-ruleset: `movementBudget`/`turnState` are ruleset-agnostic;
  `usePlayerDragging` has no 2024 twin — no sibling change needed.
- `Map.jsx` flush-on-up ordering left as-is: with the ghost pinned, what
  it flushes is always within budget; its echo equals live state and the
  guard skips it.

### Files changed
- `src/services/combat/movementBudget.js` (+`reachableWithinBudget`)
- `src/services/combat/movementBudget.test.js` (+4 rows pinning the new set math)
- `src/components/map/hooks/usePlayerDragging.js` (press-time pin + move gate)
- `src/components/map/hooks/usePlayerDragging.test.js` (header pointer to new lane)
- `src/components/map/hooks/usePlayerDragging.movement-budget.test.js` **NEW** —
  7 rows: budget-pinned press snapshot; mid-drag over-budget refusal (the exact
  regression pin: no persistence call ever carries the raw `(9,2)`); drop lands
  snapped at `(7,2)` with `enforcement_denied … (30 ft this move)` + charge 30;
  zero-budget token pinned at start with `(0 ft)` snap log; exact-budget fits
  land+charge exact with no snap log; enforcement-off, movementBudget-off, and
  GM-Shift-bypass passthrough rows.

### Verification
- **Live re-run of the repro (test-campaign, :5173):**
  - 0-ft-remaining leg: EF @ (11,8) w/ `movementUsedFeet:30`, drag 2 cells →
    ghost refused past start (`drag-invalid`), dropped back to `(11,8)`;
    disk `EvasiveFighter @ (11,8)` post-debounce; log gained
    `enforcement_denied … snapped to the remaining budget (0 ft this move).`;
    charge stayed 30/30 (zero over-budget travel = zero bill).
  - Fresh-budget over-budget leg: turnState reset to 0 used; drag (11,8)→(18,8)
    (35 ft vs 30 speed) → token visibly stopped at budget edge `(17,8)`
    (`drag-invalid` while pointer rode `(18,8)`); fetch ledger recorded the only
    map PUT as `ef:[17,8]` — RAW `(18,8)` never hit the wire; disk settled
    `(17,8)` (the snapped cell, NOT raw), bill `movementUsedFeet:30`,
    log `enforcement_denied … (30 ft this move)`. **Expected now exact.**
  - Adjacent sanity: GM Shift teleport persisted raw `(2,2)` with **zero**
    enforcement traffic (bypass intact); post-fix re-verify of the pre-first-drag
    state required restoring the map doc — the battle-arena JSON on disk had also
    been left in a wrapped `{map:{…}}` shape by an earlier session's GET→PUT
    round-trip (which crashed `Players.jsx` on load: `players.map` undefined);
    re-stored flat with baseline tokens as part of cleanup.
- **Tests:** `npx vitest run src/components/map/hooks/usePlayerDragging.movement-budget.test.js`
  7/7 → touched folder `src/components/map/` + `src/services/maps/` +
  movement/turn/charge suites: **63 files, 788 tests, all passing**.
- **`npm run lint`:** zero warnings. **`npm run guard:no-timers`:** OK
  (no new timers — press-time snapshot, no clock).
- **Cleanup verified:** via Admin panel: change-data `{}`, log `[]`;
  battle-arena back to baseline `SA@15,9 FR@9,8 EF@1,8`, `placedItems []`.

### Notes / residuals
- UX change on the enforcement lane: the token now **stops** at the budget edge
  during the drag (red invalid) instead of trailing the cursor past budget and
  silently reverting at drop — strictly better visibility; the
  `"snapped back" toast` backlog idea still applies for the drop-side snap when
  the pointer releases past the edge.
- Mid-drag turnState churn (economy spent by another lane between press and
  drop) is still re-adjudicated only at drop by `resolveMovementBudgetDrop` —
  unchanged, pre-existing semantics.
- The map-document SSE lane still has no staleness stamp (echo vs newer local);
  the fix removes the only observed producer of stale-over-budget echoes.
  Multi-tab GM simultaneous drags remain an accepted single-author residual.

## Summary
With Enforcement `movementBudget` ON, over-budget token drags now persist at the
**snapped** cell, not the raw drop cell. Root cause: the live drag lane committed
RAW over-budget ghost cells into `mapData`; `Map.jsx`'s flush-on-pointerUp saved
that raw snapshot before the clamped write, and the save's own SSE echo overwrote
the clamped commit — disk settled raw while the log claimed a snap. Fix: press-time
budget-pinned ghost region (`reachableWithinBudget`, same Dijkstra as the drop
clamp) gates `handlePointerMove`, so every persistence lane is budget-legal by
construction; `resolveMovementBudgetDrop` stays the billing/logging authority and
enforcement is now visible mid-drag (`drag-invalid` at the edge). 7 new regression
tests + 788 touched-area tests green, lint zero warnings, live re-verified both
repro legs.
