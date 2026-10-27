# Bug: extreme weather blocks travel and tells the party to "Camp and wait it out" — but no Camp affordance exists in that state

## Summary
With an extreme-weather map (moveCostMod null), every Advance rejects with lastMessage "Extreme extreme makes travel impossible. Camp and wait it out." — yet the Camp button lives only inside the exhausted-budget banner, and `dayExhausted` can never be raised under extreme weather (every advance rejects in the cost-null branch BEFORE the budget check; the mount flag returns early when no neighbor cost is affordable). The prompt instructs an action the UI never offers. Plus two cosmetic siblings: the doubled word "Extreme extreme" (template `Extreme ${label.toLowerCase()}` over label "Extreme"), and the stale message — after a manual weather re-roll unblocks travel, `travel-lastMessage` still reads the impossible-travel prose (nothing clears it until the next successful advance).

## Steps to reproduce
Confirmed live in test-campaign, 2026-10-27 run G, on outdoor map "QA Hex 28" (gridSize 20):
1. `GET /api/campaigns/test-campaign/maps/qa-hex-28`, set `map.weather = {condition:'extreme', label:'Extreme', icon:'triangle-exclamation', visibility:0, moveCostMod:null, budgetMod:0, encounterMod:30, description:'Blizzard or sandstorm — travel impossible, forced camp'}`, `PUT` back → 200.
2. Open the map with a planned route (or adopt a file trip); press the Travel tool. Panel shows Extreme + `.weather-overlay.weather-extreme`.
3. Click `Advance One Hex` → party does not move (`travel-pathIndex` / `travel-accruedCost` unchanged); `travel-lastMessage` = "Extreme extreme makes travel impossible. Camp and wait it out."; a `travel/extreme_weather` log row is written (note: its `hex`/`terrain` are null even though the party stands on a hex — cosmetic).
4. Enumerate `.travel-panel button`: close, weather re-roll, 4 event-frequency chips, 3 pace chips, mount, Advance, Cancel — **no Camp button** (`.travel-panel-exhausted` banner absent, and by construction unreachable: no cost is payable so the budget reject and the mount flag both never fire).
5. Click `.travel-weather-reroll` until a travel-able weather lands (e.g. Storm→Fog; budget re-derives 4) — Advance works again, but `travel-lastMessage` STILL shows the stale "Extreme extreme makes travel impossible…" line until some other message write occurs.

## Expected behavior
Either the blocked state offers the prompted escape (a Camp affordance on the panel whenever `weather.moveCostMod === null`, wiring to the existing `forceCamp` seam which re-rolls the day's weather), or the message stops promising camp. Copy should read "Extreme weather makes travel impossible…" (no doubled word), and lifting the block (successful re-roll) should clear/refresh the lastMessage. The `extreme_weather` log row should carry the party hex/terrain like every other travel row.

## Actual behavior
Prompt without affordance; doubled label word; stale blocked-state message survives un-blocking; extreme_weather audit row loses location context (hex:null, terrain:null).

## Likely location
High confidence: message producer `src/hooks/management/useTravelManagement.js` ~:425-428 (`advanceOneHex` cost-null branch: `setLastMessage(\`Extreme ${weather.label?.toLowerCase() || 'weather'} makes travel impossible. Camp and wait it out.\`)`); banner gating `src/components/hex-map/TravelPanel.jsx` (`TravelExhaustedBanner` renders Camp only when `exhausted`); mount-flag early-return in `useTravelManagement.js` (~:292-301 "extreme weather … travel-impossible message lane keeps its lane" — intentional, but the lane has no camp surface); `extreme_weather` row logged from `src/components/hex-map/HexMap.jsx` handleAdvance with null pos/terrain.

## Suggested fix
Smallest honest change: render a Camp row (reusing `.travel-btn-camp` → `onForceCamp`) inside the travel panel whenever `weather?.moveCostMod === null`, and clear lastMessage (or replace it with the roll result) when a manual re-roll changes the condition. Copy: use the label alone ("Extreme weather…") via `weather.label ? \`${weather.label} makes travel impossible…\` : …`. In HexMap.jsx pass the party pos/terrain to the extreme_weather `logTravel` call. Camp-under-extreme semantics (rolls new weather, refreshes budget from the NEW roll per ff52b0907) already exist in `forceCamp` — this is a wiring/affordance gap, not new mechanics.

## Severity
Minor UX issue — no data corruption (advance rejects honestly, day state stays consistent, re-roll escape exists), but the game messages direct the player to a control that does not exist, and the audit row drops location on a state it specifically logs.

## Resolution
FIXED 2026-10-27. The diagnosis held: `dayExhausted` is structurally unreachable under a null-`moveCostMod` day (advance rejects in the cost-null branch before the budget check; the mount flag's `neighborCosts.length === 0` early-return keeps extreme weather out of the budget lane by design), so the exhausted banner — the panel's only Camp surface — never rendered, while the prompt explicitly told the party to camp. Fixed as an affordance/copy/audit wiring pass on the sanctioned seams:

- **`src/components/hex-map/TravelPanel.jsx`** — new `TravelExtremeWeatherBanner` sibling mirroring `TravelExhaustedBanner`: renders whenever `extremeWeatherBlocked(weather, dayExhausted)` (hoisted module helper to stay under the complexity cap), reusing `.travel-panel-exhausted` chrome + `.travel-btn-camp` → the existing `onForceCamp` seam (no Forced March — a zero-cost day makes marching meaningless), and self-hides while the exhausted banner is up (which already carries Camp, keeping exactly one Camp button in composite states).
- **`src/hooks/management/useTravelManagement.js`** — prompt copy: `` `${weather.label || 'Extreme'} weather makes travel impossible. Camp and wait it out.` `` — the production label IS "Extreme" (weatherService), so the old `Extreme ${label.toLowerCase()}` doubled it; now reads "Extreme weather makes travel impossible…" verbatim.
- **`src/components/hex-map/HexMap.jsx`** — `handleReRollWeather` now clears `travel-lastMessage` when the re-roll lifts the block (previous `moveCostMod === null` → new roll travels), killing the stale impossible-travel prose; `handleAdvance` logs the `extreme_weather` row with the party's current hex + terrain (`travelMgmt.currentPosition || partyPosition`, mirroring `handleForceCamp`; in-bounds unknown hex plays as 'plains'), staying null-honest only when there is genuinely no party position.

Dual-ruleset check: travel/weather live in `src/services/campaign/` + shared hooks — no 2024 twin module for this lane. Camp-under-extreme logs the `camp` row through the pre-existing `handleForceCamp` (no new logging needed).

### Verification
- **Repro re-run live** (map was deleted by run G — re-seeded `POST /maps {outdoor, gridSize 20}` + weather PUT): pre-fix confirmed first (doubled copy, no Camp in full button enumeration, stale message after extreme→Rain unblock, `extreme_weather` row `hex:null terrain:null`). Post-fix: camp row + working Camp render at MOUNT under blocked weather; Advance rejects with "Extreme weather makes travel impossible. Camp and wait it out."; Camp re-rolled Extreme→Rain with budget "0.0 / 4" + "A new day dawns…" and cleared the row; manual re-roll to Cloudy left `travel-panel-message` **null** (was stale); `extreme_weather` rows logged `hex {q:19,r:10} terrain 'plains'` (old null row + new populated row both present in the audit log).
- **Adjacent sanity live:** normal Advance ×4 (`advance@18→15` rows), event dialog + Skip, exhausted-budget banner Camp ("A new day dawns…", banner gone, 0.0/4) all intact.
- **Tests:** new `TravelPanel.extreme-weather-camp.test.jsx` (5), `useTravelManagement.extreme-weather-copy.test.js` (2), `HexMap.extreme-weather.test.jsx` (8) — 15/15 pass; touched folders `src/components/hex-map` + `src/hooks/management`: 45 files / 545 tests green (pre-fix HexMap.travel extreme_weather null-row byte stays green — null-honest fallback preserved). `npm run lint` zero warnings; `no-timers-guard` OK.
- **Cleanup:** repro map deleted (restores run-G final maps [Battle Arena, Test Map]; Battle Arena untouched — weather/travelState absent), change-data `{}` + log `[]` API-verified from closed-tab quiet state; campaign-lock held to test-campaign all session.
