# Travel pace stealth/perception/encounter-odds fields are inert — tooltips advertise mechanics nothing applies

## Summary
The `TRAVEL_PACES` table declares per-pace `encounterMod` (Slow −2, Fast +2), `perception` (+5/0/−5) and `stealthAdvantage` (Slow only), and the TravelPanel pace chips carry tooltips that promise exactly those effects ("Cautious movement, easy to spot threats and stay hidden" / "Rapid travel, harder to notice threats or stay hidden"). None of the three fields has any consumer in the codebase — event chance is computed from frequency + terrain + weather only, so walking "Fast" and sneaking "Slow" roll identical odds at the table.

## Steps to reproduce
1. In test-campaign, open an outdoor board's Travel panel (this run: `jv-travel`).
2. Hover/inspect the pace chips: `document.querySelectorAll('.travel-pace-btn')` titles read verbatim
   - Slow → "Cautious movement, easy to spot threats and stay hidden"
   - Fast → "Rapid travel, harder to notice threats or stay hidden"
3. Code census for consumers:
   - `grep -rn encounterMod src server` → the ONLY reader is `src/services/campaign/randomEventService.js:17` reading `weather?.encounterMod`. The pace-table `encounterMod` is never read (`shouldTriggerEvent(tileTerrain, weather, eventFrequency)` at `useTravelManagement.js:559` never receives pace).
   - `grep -rn "stealthAdvantage\|perception" src` → hits are unrelated mechanics (condition effects, monster senses); no one reads the pace row's fields.
4. Observation leg: over this session's ride, events fired on a plains route (Normal 12% + Rain weatherMod +10) under Slow pace; nothing about Slow dampened the roll as its own table column (−2) and tooltip promise claim.

## Expected behavior
Either the pace choice measurably affects encounter odds (and perception/stealth lanes where those numbers are meant to feed), or the pace tooltips/table stop promising effects that never happen. The tooltip is player/GM-facing rules text.

## Actual behavior
Pace changes only per-hex time and daily budget (both honestly displayed). `encounterMod`, `perception`, `stealthAdvantage` on the pace rows are dead data; the tooltips assert an outcome that never occurs — zero popup/roll/log/stat delta attributable to pace stealth.

## Likely location
`src/services/campaign/travelService.js` (`TRAVEL_PACES` rows), `src/services/campaign/randomEventService.js` (`shouldTriggerEvent` signature takes no pace), caller `src/hooks/management/useTravelManagement.js:559`, and the tooltip surface `src/components/hex-map/TravelPanel.jsx` (`title={pace.description}`). Confident (grep-zero consumers); which half (implement vs de-advertise) is a design call.

## Suggested fix
Fastest honest close: delete `encounterMod`/`perception`/`stealthAdvantage` from `TRAVEL_PACES` and rewrite the Slow/Fast descriptions to what pace actually does (time/budget). If implementing instead: thread the pace row into `shouldTriggerEvent(terrain, weather, frequency, pace)` as `(pace.encounterMod || 0)/100` and add it to `totalChance`; the perception/stealth halves need a real consumer (e.g. passive-perception prompts on event trigger) — until then don't ship them in tooltips.

## Severity
Minor UX issue with a rules-correctness sting: displayed table text promises mechanics that don't exist (the odds half is one added term away from true; the perception/stealth halves have no home yet).
