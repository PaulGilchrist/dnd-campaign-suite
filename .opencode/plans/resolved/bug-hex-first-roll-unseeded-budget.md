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

## Resolution
FIXED 2026-10-27 (fix run). The black-box diagnosis was confirmed exactly: the press lane calls `startPlanning()` (writes `travel-mode` into change-data synchronously — `useSyncedState` parks the store value before the POST) and THEN the non-persisted-weather auto-roll lands one render later; by then the mount seed effect's `hasRuntimeValue('campaign', 'travel-mode')` gate was already true, so the weather-modded budget was never published. (The file-weather lane works because the map GET lands weather *before* any press.)

**Fix** (`src/hooks/management/useTravelManagement.js`): dropped the `travel-mode` guard from the `weatherBudgetSeedRef` mount-seed effect — the bug file's suggested alternative — and rewrote the docstring. Safe because the guard only ever double-covered what the remaining gates already pin: the `travel-dailyBudget` key probe (store-first — a live/resume/carry day's stamped budget always wins) and the `initialTravelState` guard (file-trip adoption lane materializes its stamped budget in the same commit the file lands, one effect ABOVE the seed). The first-travel press clears the trip keys but NEVER writes a budget key, so on that lane the seed now writes `floor(base × budgetMod)` from the new roll through the synced lane (server + SSE + the map-file snapshot publisher all follow). No new API surface; same `effectiveBudgetForPace` helper as the camp/reroll/weatherChange seams (ff52b0907 pattern). Travel is ruleset-agnostic — no 2024 twin needed.

**Regression test**: NEW `src/hooks/management/useTravelManagement.first-roll-budget.test.js` (6 tests, rig mirrors `weather-budget-init.test.js`) — pins press→storm seeds 3, wind seeds 3, clear writes base 4, carried budget survives the first roll untouched (store-first), file trip stays the adoption lane, one-shot stands after the press-lane seed.

**Verification**:
- `npx vitest run` new file: 6/6; touched folders (`src/hooks/management/` + `src/components/hex-map/`): 52 files / 589 tests pass; `npm run lint`: zero warnings.
- Live repro re-run in test-campaign on a fresh API-created `qa-hex-verify` (outdoor, gridSize 20, no file weather), `Math.random=()=>0.9` forced storm, travel-tool press: panel reads **`0.0 / 3`** (was `0.0 / 4`), `travel-dailyBudget:3` lands in change-data (was absent), map-file `travelState.dailyBudget:3` (was 4).
- Numeric leg: 6-hex plains route, events suppressed (`Math.random=()=>0.999`) — advances accrue 1.125/hex, **3rd advance REJECTED** (banner "budget exhausted" after 2 moves, accrued pinned 2.25, `travel-dayExhausted:true` persisted). Pre-fix the day grinds to 3.375 = 3 storm hexes.
- Adjacent sanity: pace chips still re-derive (Slow→`2.3 / 1`, Normal→`2.3 / 3`); advance rows log with Storm weather.
- Cleanup: qa-hex-fixbug (repro map) + qa-hex-verify (verify map) deleted; change-data `{}` + log `[]` API-verified from a closed-tab quiet state; maps back to [Battle Arena, Test Map].

