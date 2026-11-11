# Weather `visibility` is advertised to players but never enforced anywhere

## Summary
Weather entries carry a `visibility` value (Fog=1 "limited to adjacent hexes", Mist=2, Storm=3, Extreme=0) and the travel panel's weather row shows that description verbatim to the GM table, but no code in the app reads `weather.visibility` for anything — rendering, line-of-sight, distance checks, or travel planning are completely unaffected. Fog at the table is purely a cosmetic particle overlay.

## Steps to reproduce
1. In test-campaign, open the outdoor sandbox board (this run: `jv-travel`, 40×20, party at (22,9)).
2. Whole-doc PUT the map with a fog weather entry:
   `{ condition:'fog', label:'Fog', icon:'smog', visibility:1, moveCostMod:1.0, budgetMod:1.0, encounterMod:-10, description:'Thick fog — visibility limited to adjacent hexes' }`
   The mounted board adopts it live (map-data echo): the weather overlay `.weather-overlay.weather-fog` mounts and the TravelPanel row shows "Weather: Fog — Thick fog — visibility limited to adjacent hexes".
3. Observe the board "through" the fog:
   - A POI 8 hexes away (`.poi-item`, `Far Watchtower`) still renders with `opacity="1"`.
   - Arm the travel tool and click a destination hex ~4 hexes away: a route plans normally (Advance enabled, path written) — no "beyond visibility" refusal, warning, or restriction of any kind.
4. Control leg: whole-doc PUT `weather: null` (explicit null — per-field merge). Re-probe the same POI: identical `opacity="1"`, route planning identical. The ONLY delta fog→clear is the cosmetic overlay and the description row; no board content changes at all.
5. Same for storm (`visibility:3`) — no consumer exists (step 6).
6. Code census: `grep -rn "\bvisibility\b" src server` — the only consumers of a `visibility` field are placedItem show/hide (`ItemContextMenu`, `map3dScene`), which is an unrelated per-item flag. `weatherService.js` is the sole producer of `weather.visibility`; nothing reads it.

## Expected behavior
Either the advertised mechanic exists (distant hex content restricted/dimmed, movement or destination planning beyond visibility gated, or LOS affected — anything observable), or the description copy and the `visibility` field don't promise one. A GM who reads "visibility limited to adjacent hexes" will adjudicate fog at the table using a rule the software silently doesn't apply.

## Actual behavior
Zero observable gameplay/rendering delta between fog (visibility 1) and clear for anything beyond 1 hex; the field is write-only. The panel description actively lies about game behavior. Same for Mist (2), Storm (3), Extreme (0 — though Extreme IS enforced via its separate `moveCostMod:null` travel block, the visibility:0 half is inert).

## Likely location
Producer: `src/services/campaign/weatherService.js` (`WEATHER_EFFECTS[*].visibility`, description strings). Consumers: none (confident — repo-wide grep is zero). The natural homes for enforcement would be `src/components/hex-map/HexMap.jsx` / `POILayer.jsx` / `PartyMarkerLayer.jsx` (render gating), `TravelPathLayer.jsx`/`useTravelManagement.js` (destination planning beyond visibility), or the indoor LOS/fog lane — none reference the weather object's `visibility`.

## Suggested fix
Product call first: implement or de-advertise.
- Cheapest honest fix: drop `visibility` from `WEATHER_EFFECTS` and rewrite the three descriptions (fog/mist/storm) to only state the effects that exist (cost/budget/encounter mods).
- If implementing: hex boards have no LOS system yet, so a scoped first pass could gate destination clicks to `hexDistance(party, dest) <= visibility` in `useTravelManagement` planning, with the existing refusal/toast + `travel` audit-row pattern.
Check `randomEventService.js:152` too — its mist event prose ("reducing visibility to arm's length") is flavor and fine.

## Severity
Broken feature — an advertised, player-visible rules mechanic with zero implementation; the panel copy actively misinforms table adjudication (not just missing polish).
