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
