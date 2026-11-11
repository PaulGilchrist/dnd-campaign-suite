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

## Resolution
**FIXED (de-advertise half — the suggested "cheapest honest fix", mirroring the pace-odds precedent 25f5b4ab3).** Diagnosis confirmed exactly, live and in code: fog was PUT onto a throwaway outdoor board (`wv-fog`, 40×20, party (20,10), `Far Watchtower` POI at (28,10)) and (a) the POI rendered `opacity="1"`, (b) arming Travel and clicking a destination 6 hexes away planned a full 7-node path with Advance enabled (`travel-destination`/`travel-path` GET-dumped), no refusal/warning/toast — while the panel row printed "Thick fog — visibility limited to adjacent hexes" verbatim; (c) repo-wide grep re-confirmed zero consumers of `weather.visibility` (the `visibility` hits are placedItem show/hide, toolbar/panel flag comments, and Invisibility-spell code — all unrelated). Hex boards have no LOS system, so the implement-half would mean inventing new mechanics — out of bug-fix scope, exactly as the sibling pace-odds fix ruled. The fog overlay keeps riding `icon`/`condition` (weather rendering is untouched); Extreme's enforcement stays where it always lived (`moveCostMod:null`).

**Changes:**
- `src/services/campaign/weatherService.js` — deleted `visibility` from all nine `WEATHER_EFFECTS` rows and rewrote the three lying descriptions to only state effects that exist: Storm → "Thunderstorm — terrain costs +50%, daily budget -25%", Fog → "Thick fog — encounter chance -10%", Mist → "Heavy mist — encounter chance -5%". Comment pins the rule: re-add `visibility` only WITH its consumer (mirrors the TRAVEL_PACES de-advertisement header).
- `src/services/campaign/weatherService.test.js` — verbatim mirror updated (byte-exact `toEqual` records now prove the field is gone); NEW regression test "no row carries a visibility field or advertises one it cannot enforce": every table slot of every biome must be `not.toHaveProperty('visibility')` AND description-free of `/visib/i`, with a 9-condition containment check so fog/mist/storm are provably rolled.
- Fixture sweep (weather prop-copies de-fossilized to match the new rows): `src/components/hex-map/TravelPanel.effective-event-chance.test.jsx` (RAIN/FOG), `src/components/hex-map/HexMap.extreme-weather.test.jsx` (EXTREME), `src/components/hex-map/TravelPanel.extreme-weather-camp.test.jsx` (EXTREME).
- `randomEventService.js:172` mist EVENT prose ("reducing visibility to arm's length") left untouched — narrative flavor, per the bug file's own note. No dual-ruleset twin exists for this service (2024 lane shares the single module).

**Live verification (test-campaign, Vite :5173/Express :80):**
- PRE-fix repro as above (exact filed behavior reproduced first, including the identical fog→clear cosmetic-only delta).
- POST-fix: in-page service probe (`await import('/src/services/campaign/weatherService.js?cb=…')` past the module cache) returns field-free records, fog/storm copy byte-exact to the new strings, `anyVisibility:false`. Board re-mounted with the fog doc: `.weather-overlay.weather-fog` still mounts (overlay honesty intact), POI still opacity 1, 6-hex destination still plans and advances honestly — and the panel row now reads "Weather: Fog — **Thick fog — encounter chance -10%**", which the event-odds row independently corroborates ("2% chance per hex (base 12%, -10 fog)") — the advertised number IS the applied number now. Adjacent sanity: one Advance press walked the path (REMAINING 6→5, `travel`/`advance` audit row `weather:"Fog"` logged), `effectiveEventChance` attribution unregressed.
- Cleanup: trip cancelled, `wv-fog` DEACTIVATED→DELETED (ghost GET 404 honest), maps back to the 4 owner fixtures all inactive, battle-arena md5 `94fcd0bf` byte-exact, closed-tab two-pass clears GET-verified `change-data {} + log [] + overlays []`.

**Tests/lint:** `weatherService.test.js` 6/6; touched folders green — `src/services/campaign` + `src/hooks/management` 40 files/466 tests, `src/components/hex-map` 54 files/576 tests, plus `Map.outdoor-switch` + `LogTravel` 18/18; `npm run lint` zero warnings; `no-timers-guard` OK.
