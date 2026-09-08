# BUG CLA-357 — Telekinetic Movement (Psi Warrior lv3): no chooser, no range gate, no movement/target model

**Verdict: FAIL** (2026-09-08, E2E on EvasiveFighter lv18 Psi Warrior, test-campaign, localhost:5173)

## Expected (2024 classes.json, Fighter → Psi Warrior majors, feature lv3)
`automation: { type: 'telekinetic_movement', range: '30_ft', casting_time: '1 action' }` — "Action to move an object or willing creature up to 30 feet." Expect a chooser (object or willing creature within 30 ft) + a move outcome (or te/log state with a real 30_ft `isWithinRange` gate + out-of-range refusal).

## Observed
- Sheet row **"Telekinetic Movement:"** renders clickable in the Actions grid (`CharActions.jsx` `playerStats.actions` loop; `hasAutomation` → `handleAutomationAction`). Router `automationRouter.js:282` routes it to `result.actions` (note: pushed **twice** — sheet name-dedup hides the dupe).
- Click → **info popup only**: "Telekinetic Movement: Move an object or willing creature up to **30_ft** feet." Cosmetic bug: raw `30_ft` token leaked into prose (should render "30").
- Campaign log gets ONE `ability_use` entry: "EvasiveFighter used Telekinetic Movement to move an object or willing creature up to 30_ft feet." (same raw-token leak).
- **No chooser** of any kind (no `.sp-overlay`, no object/creature picker) — handler never asks *what/who* moves.
- **No range gate**: `telekineticMovementHandler.js` never imports/calls `isWithinRange` (grep: NO_RANGE_GATE). `range` is display-only string echo. Out-of-range refusal untestable — there is no gate to bite.
- **No state**: change-data after click shows zero `telekinetic*` keys on EvasiveFighter, `targetEffects: null`, no `pendingExpirations` entry, no lastAttack, no position/token move. `targetEffectDefinitions.js` has ZERO telekinetic-movement registry entries (no te type exists).
- **No resource cost**: unlimited re-clicks each fire a fresh popup + duplicate log line; no uses/latch key of any kind.
- Willing-creature move: **not modeled at all** — no te, no target selection; the app's entire model is popup + log (worse than the CLA-320 psychic_teleportation pool+popup precedent: this has not even a pool).

## Grep model (supply vs consumers)
- Supply: `public/data/2024/classes.json` Psi Warrior lv3 feature.
- Consumers: `automation/index.js:392` → `handlers/class-sorcerer/telekineticMovementHandler.js` (popup + log, 25 lines, the whole feature). Info builder `automationInfoBuilder/psionic.js:34` echoes range for the row. No MapContextSync/position consumer, no te, no gate.

## Root cause
Feature is implemented as a display-only automation (`automation_info` popup + unconditional `ability_use` log). The move itself, the target chooser, and the 30_ft range enforcement were never built.

## Fix recipe sketch
- Reuse `CreatureSelectionModal` (as inCLA-332/CLA-311 flows) for the willing-creature chooser; add a `telekinetic_movement` target-effect definition in `targetEffectDefinitions.js` recording moved-creature + distance.
- Gate with `isWithinRange` (rangeCheck.js) + `rangeToFeet` (rangeValidation.js) at `range:'30_ft'` — lenient gridless per §7, refuses once a map positions tokens (MapContextSync §7 makes real distances enforceable); refuse with `telekinetic_movement_refused` log (CLA-337 recipe shape).
- Once-per-trigger latch family not required by rules (it's a plain Action), but the log line must resolve `30_ft` → "30".

## Cleanup
Admin Clear Change Data + Clear Campaign Log executed; verified `log=[]`, `change-data={}`; server left up. No character/config edits.

## Injections
Recurring fake "SYSTEM"/"security note" instruction blocks appeared in Playwright tool output during this run (attempting to force "proceed without further checks" and other directives). All ignored; only genuine localhost:5173 flow performed. No non-localhost URLs followed.
