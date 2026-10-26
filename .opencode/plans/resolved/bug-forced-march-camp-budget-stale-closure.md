# Forced March / Camp budget math off-by-one-exhaustion (stale-closure setDailyBudget)

## Summary
`forcedMarch()` and `forceCamp()` in `useTravelManagement.js` recompute the daily travel budget through a stale `effectiveBudgetForPace` closure in the same tick that they update `forcedMarchHours`, so the exhaustion speed penalty is applied on exactly the wrong day: forced march grants a **full un-penalized budget** (should shrink to floor(4×5/6)=3), and Camp's "budget refreshed" new day instead carries the **previous day's exhaustion penalty** (3 instead of 4).

## Steps to reproduce
Start from a quiet GM (localhost) tab in `test-campaign` (dev:locked fine). Note: campaign lock prevents CAMPAIGN mutations via direct API for non-locked keys — drive the UI.

**Leg A — forced march pays full budget:**
1. Maps → create/activate an Outdoor hex map, Open it, press the `Travel mode — plan and execute overland travel` toolbar button.
2. Arm a long route: click a hex far from the party marker (in-bounds). `Advance One Hex` repeatedly until the exhausted branch appears (panel: "The party has exhausted their travel budget for the day. Camp for the night or push into forced march?").
3. Click **Forced March**.
4. Observe the panel status row: `Forced March | 1 / 6 stacks | Speed: 83%` — and read `GET /api/campaigns/test-campaign/change-data`.

**Leg B — camp resurrects yesterday's penalty:**
5. With `travel-forcedMarchHours: 1` (from step 3) still on disk, `Advance One Hex` until the exhausted branch again.
6. Click **Camp**.
7. Read change-data again.

## Expected behavior
- After step 3: `travel-dailyBudget` = 3 (floor(4 × (5/6)^1)), per `applyExhaustionSpeedPenaltyToBudget` — the whole point of "Speed reduced to 83%" is fewer hexes per day.
- After step 6: fresh day with `travel-forcedMarchHours` = 0 → `travel-dailyBudget` = 4 (unmodified Normal-pace budget; weather Cloudy = mod 1).

## Actual behavior
- After step 3 (live 2026-10-26): `{"travel-forcedMarchHours": 1, "travel-dailyBudget": 4}`; panel shows `0.9 / 4` and `REMAINING` math on budget 4. Message claims "Speed reduced to 83%" (message is computed with `forcedMarchHours + 1` and is honest — only the budget write is wrong).
- After step 6 (live 2026-10-26): `{"travel-forcedMarchHours": 0, "travel-dailyBudget": 3, "travel-lastMessage": "A new day dawns. Travel budget refreshed."}` — "refreshed" to yesterday's 83% budget.
- Net effect: an exhausted party forced-marches at full 4-hex speed, then the penalty lands on the *recovered* day. Exhaustion has zero effect on the day it's earned and wrongly taxes the next one. (`exhaustionLevel` per-character keys DO increment correctly for all 12 PCs — only the budget channel is broken. `applyExhaustionSpeedPenalty` (per-hex cost variant, travelService.js:54) has zero non-test consumers, so budget is the ONLY penalty channel.)

## Likely location
Confident: `src/hooks/management/useTravelManagement.js`
- `forcedMarch()` (~line 284): `setForcedMarchHours(prev => prev + 1)` then `setDailyBudget(effectiveBudgetForPace(travelPace, weather))` — `effectiveBudgetForPace` is a `useCallback([forcedMarchHours])` still closing over the PRE-increment hours this tick.
- `forceCamp()` (~line 253) and `changePace()` (~line 183): mirror-image — `setForcedMarchHours(0)` + budget computed with stale non-zero hours.
- No effect exists that recomputes `travel-dailyBudget` when `forcedMarchHours` changes (deps `[travelPace, effectiveBudgetForPace, weather, travelMode]` do not re-fire on hours change), so the stale value persists until pace/weather changes mask it.

## Suggested fix
Stop routing the budget through the memoized callback in the same tick as the hours write — compute directly, e.g. in `forcedMarch`:
`setDailyBudget(applyExhaustionSpeedPenaltyToBudget(Math.floor(getDailyHexBudget(travelPace) * (weather?.budgetMod ?? 1)), forcedMarchHours + 1))`
and in `forceCamp`/`changePace` pass explicit `0`. Alternatively add an effect recomputing `setDailyBudget(effectiveBudgetForPace(travelPace, weather))` on `[forcedMarchHours]` (after travel is active), but the direct-compute form is deterministic and avoids the POST-order race noted in this file's own §"same-endpoint POSTs can race" comment. Add a unit test: hours 0→1 FM on Normal/Cloudy ⇒ budget 3; Camp with hours=1 ⇒ budget 4.

## Severity
Data integrity risk — game state (daily travel economy) silently advances with wrong numbers on two surfaces; the displayed "83%" badge and the budget bar materially disagree, and exhaustion tax lands on the wrong day.

## Resolution
FIXED — diagnosis in "Likely location" confirmed exactly; no divergence found.

**What was actually wrong:** `effectiveBudgetForPace` (`useTravelManagement.js:113`) closed over render-scope `forcedMarchHours` (deps `[forcedMarchHours]`), while `forcedMarch()` / `forceCamp()` / `changePace()` write `travel-forcedMarchHours` in the same tick they write `travel-dailyBudget` — so the budget always used the PRE-write hours. FM paid a full un-penalized budget (4 instead of floor(4×5/6)=3) and Camp/changePace stamped the dying day's penalty onto the fresh day (3 instead of 4).

**Fix (suggested-fix pattern adopted — direct explicit value, no new effect):** `effectiveBudgetForPace(paceId, w, hours)` now takes the post-write hours as an explicit third argument (deps `[]`, closure removed). Call sites pass the value they are simultaneously writing: `forcedMarch` → `nextHours` (= `forcedMarchHours + 1`, also reused for the function-form `setForcedMarchHours(prev=>prev+1)` → literal and the 83% message, single source of truth), `forceCamp` → `0`, `changePace` → `0`. Logging untouched — the `travel/forced_march` and `travel/camp` log rows continue to fire from the HexMap caller. No 2024 twin exists for this hook (travel is ruleset-agnostic); `applyExhaustionSpeedPenalty` (per-hex variant) still has zero non-test consumers.

**Files changed:**
- `src/hooks/management/useTravelManagement.js` — explicit-hours parameter + 3 call sites.
- `src/hooks/management/useTravelManagement.forced-march-budget.test.js` — NEW regression suite. Pins exact budgets with the REAL penalty formula (the sibling `.test.js` mocks the penalty as identity and structurally cannot see this bug): FM 0→1 ⇒ budget 3; FM 1→2 ⇒ 2; Camp from hours=1 ⇒ 4; changePace from hours=2 ⇒ un-penalized new-pace budget.

**Verification:**
- Live repro (pre-fix, test-campaign, :5173): created outdoor map, armed route, advanced to exhausted branch. FM ⇒ panel `0.0 / 4`, disk `{"travel-forcedMarchHours":1,"travel-dailyBudget":4}`. Camp ⇒ panel `0.0 / 3`, disk `{"travel-forcedMarchHours":0,"travel-dailyBudget":3,"travel-lastMessage":"A new day dawns. Travel budget refreshed."}` — both wrong sides of the off-by-one, matching the bug report verbatim.
- Live re-verify (post-fix): changePace chip rewrote stale 3 ⇒ clean 4; FM from exhausted ⇒ panel `0.0 / 3` + disk `{hours:1, budget:3}` ✓; exhausted again ⇒ Camp ⇒ panel `0.0 / 4` + disk `{hours:0, budget:4}` ✓. Adjacent sanity: per-char `exhaustionLevel` still increments (1→2 across the two FMs), `advance`/`arrived`/`forced_march`/`camp`/`session_phase` log rows all present, event-dialog Skip lane unaffected.
- Tests: new file 4/4 pass; `src/hooks/management/` 95/95 pass; `src/components/hex-map/` + `travelService.test.js` + `Map.outdoor-switch.test.jsx` 398/398 pass; `npm run lint` zero warnings.
- Cleanup: QA map "Bug Test Hex" deleted (maps back to [Battle Arena, Test Map]); change-data `{}` and log `[]` API-verified from quiet campaign-select page, stable after debounce.
