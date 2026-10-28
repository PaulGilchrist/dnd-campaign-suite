# First-travel weather auto-roll never seeds the weather-modded daily budget

## Summary
On a fresh outdoor map with no persisted weather, pressing the travel tool auto-rolls weather — but when that roll lands on a budget-modifying condition (e.g. Storm, budgetMod 0.75), `travel-dailyBudget` is never written and every client runs the day on the un-modded base 4. Reproduced 2026-10-27 (run M) in test-campaign on `qa-hex-runm`.

## Steps to reproduce
1. In test-campaign, create an outdoor map via API: `POST /api/campaigns/test-campaign/maps {name, type:"outdoor", gridSize:20}` (no `weather` key on file).
2. In the browser, before pressing the travel tool, stub `Math.random = () => 0.9` in-page (temperate table index 7 = Storm; restore after the press).
3. Open the map, press the Travel tool (`button[title="Travel mode — plan and execute overland travel"]`).
4. Observe: weather overlay + panel show **Storm** ("daily budget -25%") — but the panel budget readout says `0.0 / 4`, and `GET /change-data` has **no `travel-dailyBudget` key**.
5. Plan a ≥4-hex plains route and Advance repeatedly (stub `Math.random=()=>0.999` to suppress events): the party accrues 1.125/hex (storm moveCost mod applied) and only flags `travel-dayExhausted` at **accrued 3.375 (3 hexes)**.
6. Control: click pace chip Slow → `travel-dailyBudget:1` appears; Normal → `3`. Every pace/camp/reroll seam re-derives correctly.

## Expected behavior
A storm roll means budget `floor(4×0.75)=3` from the moment it is rolled (as proven for the file-weather mount lane by 08142ae0a, run E/F): panel should read `0.0 / 3` and the 3rd advance (3.375 > 3) should reject.

## Actual behavior
Budget stays store-absent / lazy-default 4 all day: the party travels 3 hexes instead of 2 in a storm (extra 1.125 move), SSE peers see no budget key at all, and the map-file `travelState` snapshot persists the wrong `dailyBudget:4`. No console errors — silent numeric drift.

## Likely location
Confident (code-read): `src/hooks/management/useTravelManagement.js` mount seed `weatherBudgetSeedRef` effect (:298–306). Its docstring claims a later first-travel auto-roll "rides those re-derives" via "the seams below", but the auto-roll seam — `useTravelToolSync.js:120` calling `HexMap.jsx:130 handleGenerateWeather` — only `setWeather`s; it publishes no budget. By the time the weather prop re-fires the seed effect, `travel-mode` is already in change-data (startPlanning wrote it in the same press), so the `hasRuntimeValue('campaign','travel-mode')` guard (:303) returns early. The file-weather lane works only because weather arrives from the map GET *before* any press.

## Suggested fix
Make the first-travel auto-roll publish the budget through the same helper: in `HexMap.jsx` `handleToolActivation` path (or immediately after `handleGenerateWeather()` in `useTravelToolSync.js:120-122`, non-persisted-weather branch only), call the existing budget re-derivation (`effectiveBudgetForPace(travelPace, newWeather, 0)` → `setDailyBudget`) with the NEW roll — the same weatherOverride pattern ff52b0907 established for camp/reroll. Alternatively, drop the `travel-mode` guard from the seed effect and rely solely on the budget-key guard (store-first) plus `initialTravelState` (adoption lane).

## Severity
Data integrity risk — wrong move budget (≈33% too generous under storm) for an entire in-game day on every fresh map whose first roll is budget-modding (temperate 1/8 storm; cold/arid also roll wind/extreme), mirrored to all clients and the map file; silent, no error.
