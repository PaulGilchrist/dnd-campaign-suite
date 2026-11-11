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

## Resolution
FIXED 2026-11-11. The diagnosis in the bug file was correct: `frequencyChance` read only the `EVENT_FREQUENCIES` table while `shouldTriggerEvent` rolled `freq + terrainMod + weather.encounterMod/100`.

**What changed:**
- `src/services/campaign/randomEventService.js` — hoisted the terrain-mod table and extracted the shared formula into `eventChanceBreakdown(terrain, weather, frequencyKey)` (returns `{base, terrainMod, weatherMod, total}` so the display can attribute each modifier) + `effectiveEventChance(...)` (the total). `shouldTriggerEvent` now rolls against `effectiveEventChance` — display and roll share ONE implementation. Semantics preserved byte-for-byte: none/invalid frequency still refuses without consuming a roll, and the NaN fail-closed lane (non-numeric `encounterMod` poisons the total) is unchanged (`randomEventService.test.js` untouched and green).
- `src/components/hex-map/TravelPanel.jsx` — the active Events row now renders `activeFrequencyChance(eventFrequency, currentTerrain, weather)`: the effective percent with modifiers attributed, e.g. `22% chance per hex (base 12%, +10 rain)` / `40% chance per hex (base 12%, +8 swamp, +20 storm)`. Fallbacks stay honest base labels: no route planned yet (roll terrain undetermined), zero mods, None frequency (mods never resurrect it — breakdown early-zeroes), and a NaN-poisoned total (the panel declines to invent a number; the roll fail-closes). Negative totals (fog on Sparse) clamp to 0%. Chip tooltips keep the per-frequency BASE as suggested.

**Verified live (test-campaign, sandbox map `bf-eventchance`, deleted after):** reproduced first — panel read "12% chance per hex" while the weather row read Rain on the plains route. Post-fix re-verified: same rig now reads `22% chance per hex (base 12%, +10 rain)`; live weather reroll differentials Rain→"22%…", Cloudy/Clear→"12% chance per hex" (no suffix), Storm→"32%… (+20 storm)"; doc-PUT swamp onto the party hex + Storm→"40%… (+8 swamp, +20 storm)" (SSE echo-adopted). Advance One Hex fired "Wolves on the Hunt" with the display updating to the new hex (plains+storm→"32%…") and honest `travel`/`advance_with_event` + `event_skip` log rows; Skip and Cancel behaved (dialog closed, travel-mode inactive). Chip tooltips unchanged base bytes. Cleanup: sandbox map deactivated→DELETED (ghost 404), change-data `{}` + log `[]` GET-verified closed-tab, maps back to the 4 owner fixtures.

**Tests:** new `src/services/campaign/randomEventService.effective-event-chance.test.js` (breakdown values + roll-equality matrix across every terrain × weather × frequency tier: fires just below the shared total, refuses at/above it) and `src/components/hex-map/TravelPanel.effective-event-chance.test.jsx` (exact display bytes for the repro + terrain/fog/mid-route faces, all base-label fallbacks, chip-tooltip base pin, and a display-percent == roll-threshold equality loop re-deriving from the REAL service). New tests 22/22; touched area `src/services/campaign` + `src/components/hex-map` + `src/hooks/management` 93 files / 1037 tests green; `npm run lint` zero warnings; `no-timers-guard` OK.

