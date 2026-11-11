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

## Resolution
**FIXED (de-advertise half — the suggested "fastest honest close").** The bug diagnosis was confirmed exactly: the pace rows' `encounterMod`/`perception`/`stealthAdvantage` had zero consumers repo-wide (`shouldTriggerEvent`/`eventChanceBreakdown` read terrain + weather + frequency only; every `encounterMod` hit is the *weather* row's field, `stealthAdvantageApplies` in `useCharActionsBaseActions.js` is a condition-effect lane, `skillBonuses.perception` is NPC skills — all unrelated). The perception/stealth halves have no consumer to home, so implementing them would mean inventing new mechanics — out of bug-fix scope. The odds half COULD have been implemented by threading pace into `eventChanceBreakdown` like the sibling `bug-event-chance-label-ignores-mods` fix, but that would leave the tooltips still half-lying, so de-advertising both halves together is the honest close and does not regress the sibling fix (its shared breakdown/`+2 hills` attribution live re-verified intact).

**Changes:**
- `src/services/campaign/travelService.js` — deleted `encounterMod`/`perception`/`stealthAdvantage` from all three `TRAVEL_PACES` rows; rewrote the tooltips to what pace actually does: Slow → "Cautious movement — slowest travel, smallest daily hex budget", Fast → "Rapid travel — fastest movement, largest daily hex budget" (Normal unchanged). Comment pins the rule: re-add the fields only WITH their consumer.
- `src/services/campaign/travelService.test.js` — the old pin "full perception and encounter modifiers" actively asserted the dead fields; replaced with a pin of time-data-only rows + `not.toHaveProperty` on each dead field.
- `src/components/hex-map/TravelPanel.pace-tooltips.test.jsx` (NEW) — locks the three byte-exact honest chip tooltips, forbids any `/hidden|stealth|spot|percept|notice|threat|encounter|chance/i` advertising, re-pins the field-free rows, and locks the effective-chance row as pace-independent (hills + Normal = "14% chance per hex (base 12%, +2 hills)" identically at slow/normal/fast).

**Live verification (test-campaign, poi-showcase outdoor board):**
- PRE-fix repro: chips carried the verbatim advertised titles; route via hills read "14% chance per hex (base 12%, +2 hills)" identically at Slow/Normal/Fast while time/budget honestly moved (next-hex 3h/2h/1h 30m, budget 2.0/4.0/5.0) — zero odds delta attributable to pace, exactly as filed.
- POST-fix re-run of the same steps: chip titles byte-exact to the new honest copy, no pace tooltip matches the stealth/perception word set; pace press still moves only NEXT HEX time and BUDGET; odds row + sibling-fix terrain-mod attribution unchanged; `.travel-pace-btn` guard behavior (button click doesn't fire the destination toast) intact.
- Cleanup: trip cancelled, Admin "Clear Change Data" + "Clear Campaign Log" (change-data `{}`, log `[]` GET-verified), poi-showcase back to inactive (all 4 owner fixtures inactive, none created/deleted), `git status --porcelain public/campaigns/` empty.

**Tests/lint:** `TravelPanel.pace-tooltips.test.jsx` 4/4 pass; touched folders green — `src/services/campaign` 20 files/288 tests, `src/components/hex-map` 54 files/576 tests, `src/hooks/management` 20 files/177 tests; `npm run lint` zero warnings; `no-timers-guard` OK. Full `npm run test:run`: 3218 files / 34680 tests passed (174 s), zero failures.
