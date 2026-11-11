# Event-chance label shows the raw frequency while the roll adds terrain + weather modifiers

## Summary
The Travel panel prints "12% chance per hex" (and the frequency-chip tooltips likewise) straight from the `EVENT_FREQUENCIES` table, but `shouldTriggerEvent` rolls `freq.chance + terrainMod + weather.encounterMod/100`. With Rain active (+10) on this session's plains route the true per-hex chance was 22% while the panel kept claiming 12% — a displayed number that is wrong in the exact conditions the weather row advertises ("Heavy rain" + the storm description's encounter framing).

## Steps to reproduce
1. In test-campaign, open an outdoor board and the Travel panel (this run: `jv-travel`, live-auto-rolled Rain, Event frequency Normal).
2. Read the panel: `.travel-frequency-desc` shows "12% chance per hex" while the weather row simultaneously shows Rain.
3. Compare with the code: `src/services/campaign/randomEventService.js` `shouldTriggerEvent` → `totalChance = freq.chance + terrainMod + (weather?.encounterMod || 0) / 100` — Rain `encounterMod: 10` ⇒ effective 22% on plains; Swamp would add another +8%.
4. `frequencyChance` in `src/components/hex-map/TravelPanel.jsx` is `` `${Math.round(f.chance * 100)}% chance per hex` `` — takes the frequency object only; no terrain or weather input anywhere on that render path.
5. Live witness: on this run's Normal-frequency plains+Rain leg an event fired on the second advance (an outcome whose honest odds were 22%/hex while the UI said 12%).

## Expected behavior
The displayed chance should be the chance actually being rolled for the party's current terrain + weather (e.g. "22% chance per hex (Normal +10 rain)"), or at minimum the label should say "base chance" so it isn't read as the live number.

## Actual behavior
A flat table value is presented as THE per-hex chance, silently wrong by +10/+20 (rain/storm), up to +8 (swamp), −10/−5 (fog/mist), ±2 (per pace claim — see companion bug; pace is NOT actually applied). Close-but-not-exact display during the exact mechanics the panel is explaining.

## Likely location
`src/components/hex-map/TravelPanel.jsx` `frequencyChance()` (~line 119) and its two call sites (`:369` active-frequency row, `:376` chip tooltips). Confident: it is the only surface producing this string; the roll side is `randomEventService.shouldTriggerEvent`.

## Suggested fix
Thread the live inputs in: HexMap already has `weather` and the party's current terrain — compute the effective chance with the same formula (export a `effectiveEventChance(terrain, weather, frequencyKey)` from `randomEventService.js` so display and roll share ONE implementation) and render e.g. "22% chance per hex (Normal, rain +10%)". Keep the base value in the chip tooltips per-frequency (terrain changes per hex). Pin with a TravelPanel table row + an equality test that display and roll never diverge.

## Severity
Minor UX issue — pure display correctness, no state impact — but it displays alongside mechanics it misquotes, so table adjudication trusts a stale number.
