# Camp / manual weather re-roll writes the travel budget from the STALE (pre-re-roll) weather

## Summary

When the day's travel budget is refreshed (Camp) or weather is manually re-rolled, the new `travel-dailyBudget` is computed from the weather that was active BEFORE the re-roll, not the fresh roll. The budget is permanently one weather-generation out of date until the GM happens to toggle the pace chip (which recomputes with the current weather). Surfaced while verifying commit a2ff18611 (no-weather-reroll-on-tool-mount) — the same stale-closure class of bug that 85ef0e55f fixed for `forcedMarchHours` by passing it explicitly, but the weather argument was left stale at these two call sites.

## Steps to reproduce

Starting state: in `test-campaign`, an outdoor hex map whose file carries `weather: storm` (budgetMod 0.75) on disk (PUT `/api/campaigns/test-campaign/maps/<slug>` with a storm weather object; storm moveCostMod 1.5 / budgetMod 0.75).

1. Open the hex map editor; confirm the Storm overlay renders (`.weather-overlay.weather-storm`).
2. Press the Travel tool (`button[aria-label*="Travel mode"]`). Confirm panel shows Storm and pace Normal; change-data shows `travel-dailyBudget: 3` (= floor(4 × 0.75) — correct, storm).
3. Plan a westward path of ≥ 3 hexes (click hexes left of the party marker; ~104 screen px per hex at zoom 2, off-hex clicks are silent no-ops).
4. Click `Advance One Hex` twice (each plains leg accrues 0.75 × 1.5 = 1.125; accrued reaches 2.25; the third leg would cost 3.375 > 3 → exhausted branch).
5. Click `Camp` in the exhausted banner (`.travel-panel-exhausted .travel-btn-camp`).
6. Read change-data `travel-dailyBudget` and the map file `weather`:
   - Observed: weather re-rolled (e.g. `cloudy`, budgetMod 1.0) but `travel-dailyBudget` is still **3** — yesterday's storm-modified budget. Expected **4** for a Cloudy Normal day.
7. Control leg (manual re-roll): with weather Cloudy / budget 3, click the panel weather re-roll button (`.travel-weather-reroll`) until it lands Storm. `travel-dailyBudget` stays **4** (the stale Cloudy budget) although current weather is Storm (budgetMod 0.75). Expected 3.
8. Recovery proof (mechanism exists): click pace chip Slow → budget becomes **1** (= floor(2 × 0.75)); Normal → **3**. Pace changes recompute with the CURRENT weather correctly, isolating the defect to the two weather-regen seams.

## Expected behavior

The new day's budget (Camp) and the budget after a manual weather re-roll must be computed from the NEW weather's `budgetMod` (Cloudy Normal = 4, Storm Normal = 3), consistent with `handleReRollWeather`'s intent of re-deriving travel economics from the fresh roll.

## Actual behavior

Budget is written from the pre-re-roll weather (stale React closure value, since `handleGenerateWeather()`'s `setWeather` is not visible in the same synchronous tick):
- Camp: Cloudy day runs with budget 3 (all travel economics — exhausted seam, FM budget, log rows — wrong for the whole day unless the GM toggles pace).
- Manual re-roll: re-roll to Storm leaves budget 4 — party gets a full clear-weather day in a thunderstorm.
No console errors; the wrong value is POSTed to change-data, broadcast via SSE, and persisted in the map file's `travelState` — data-integrity, not just UI.

## Likely location

Confident (code read matches observed arithmetic exactly):
- `src/components/hex-map/HexMap.jsx` `handleForceCamp` (≈ line 197): calls `travelMgmt.forceCamp()` FIRST — which writes `setDailyBudget(effectiveBudgetForPace(travelPace, weather, 0))` with the OLD `weather` closure (`useTravelManagement.js:257-266`) — and only THEN `handleGenerateWeather()`. No budget recompute follows.
- `src/components/hex-map/HexMap.jsx` `handleReRollWeather` (≈ line 203): `handleGenerateWeather()` then `travelMgmt.changePace(travelMgmt.travelPace)` — `changePace` (useTravelManagement.js:190) reads the same stale `weather` closure within the tick, so the recompute it triggers uses the pre-roll weather.

## Suggested fix

Follow the precedent set by the 85ef0e55f hours fix (explicit post-write values instead of closure reads): make weather-regen seams pass the NEW weather object to the budget recompute.

- `generateWeather()` is pure — compute `const w = generateWeather(currentTerrain)` once, `setWeather(w)`, and hand `w` down. E.g. change `forceCamp`/`changePace` to accept an optional `weatherOverride` (`effectiveBudgetForPace(paceId, w ?? weather, hours)`), and in `handleForceCamp`/`handleReRollWeather` roll first, then call `travelMgmt.forceCamp(newWeather)` / `travelMgmt.changePace(pace, newWeather)`.
- Alternatively, an effect that recomputes `travel-dailyBudget` when `weather` changes and the day is not exhausted — but the explicit-value lane is more deterministic and matches the owner's existing fix idiom.
- Extend `HexMap.additional.test.jsx` (which already pins `regeneratesWeather: true` for camp) with the budget-vs-new-weather assertion, and `useTravelManagement.forced-march-budget.test.js` with the override parameter.

## Severity

Data integrity risk — a wrong-but-plausible budget number is written to the runtime store, broadcast to every player, applied to exhaustion adjudication for the whole in-game day, and survives reloads (only self-heals on an incidental pace toggle). No crash, no user-visible error.
