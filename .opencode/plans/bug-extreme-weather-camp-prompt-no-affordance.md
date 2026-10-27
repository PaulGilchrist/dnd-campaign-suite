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
