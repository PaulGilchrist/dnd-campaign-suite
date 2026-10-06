# BUG CLA-140 — Fiendish Resilience re-choose blocked until Long Rest (spec: Short OR Long Rest)

## Title
CLA-140 Fiendish Resilience (2024 Warlock Fiend Patron lv10): damage-type chooser refuses re-pick after a completed Short Rest; long-rest resistance mechanic itself works exactly.

## Overview
The chooser, the resistance application, the Force exclusion, the 12-type list, the choose/change logging, and the long-rest re-arm all behave exactly as specified. However, the feature's own trigger text ("when you finish a Short or Long Rest") is only half-implemented: the handler gates the chooser with `_fiendishResilienceUsed`, which is reset ONLY by Long Rest. After completing a Short Rest in the UI, clicking the feature returns "already been used this long rest. Finish a long rest to use it again." — refusing the Short-Rest re-choose that the canonical text explicitly allows.

## Expected Behavior (canonical app-data wording)
From `public/data/2024/classes.json` → Fiend Patron → "Fiendish Resilience":
> "Choose one damage type (other than Force) when you finish a Short or Long Rest. Resistance to that type until you choose a different one."

Re-choose must be available after finishing a **Short** Rest (as well as a Long Rest).

## Actual Behavior
- Choose → resistance → change (via Long Rest): EXACT (see evidence).
- After a fully completed Short Rest (clicked "Complete Short Rest", `short_rest` logged), clicking Fiendish Resilience shows refusal popup: "Fiendish Resilience has already been used this long rest. Finish a long rest to use it again." Runtime state after short rest: `_fiendishResilienceUsed=True` (unchanged), `_Fiendish_Resilience_chosenType="Fire"`.
- After a Long Rest: `_fiendishResilienceUsed` reset to null, chooser re-opens, re-pick Cold works ("Fiendish Resilience — damage type changed to Cold"; sheet shows "Resistances: Cold", Fire gone).

## Steps to Reproduce
1. test-campaign, HexWarlock (Warlock / Fiend Patron lv20, 2024 ruleset).
2. Long Rest → click "Fiendish Resilience:" → pick Fire → "Choose Damage Type". Sheet shows "Resistances: Fire".
3. Go to character sheet, click "Short Rest" → "Complete Short Rest" (short_rest logged).
4. Click "Fiendish Resilience:" again.
5. ACTUAL: refusal popup "already been used this long rest". Chooser unreachable. EXPECTED: chooser opens, re-pick permitted.

## Live evidence (2026-10-05)
- Magmin 1 (Fire touch 2d4+2) vs HexWarlock while Fire chosen: log `automation` "HexWarlock has resistance to Fire damage — 8 damage halved to 4."; `hp_change` breakdown `{"damageType":"Fire","amount":4,"resisted":true}`; HP 103→99.
- Control: Bandit 1 Scimitar Slashing 2 dmg: `hp_change` `{"damageType":"Slashing","amount":2,"resisted":false}`; HP 99→97. Zero resistance on non-chosen type ✓.
- Long Rest re-arm + change to Cold: change-data `_Fiendish_Resilience_chosenType` "Fire"→"Cold", `_fiendishResilienceUsed` True→None(long rest)→True(re-pick); sheet "Resistances: Cold".
- Modal excludes Force, lists exactly the 12 automation damageTypes ✓.
- Short-Rest refusal: popup text captured live after `short_rest` log entry; `_fiendishResilienceUsed` still True.

## Likely Location
- `src/services/automation/handlers/class-warlock/fiendishResilienceHandler.js:16-27` — `handle()` returns refusal popup when `getRuntimeValue(playerStats.name, '_fiendishResilienceUsed')`.
- `src/services/rules/effects/restRules-constants.js:246` — `'_fiendishResilienceUsed'` appears ONLY inside `export const LONG_REST_RESOURCES` (line 102); absent from the short-rest reset list (`restRules-shortRest.js` has no fiendish lane). Feature data in `public/data/2024/classes.json` carries no `rest` metadata distinguishing the gate (row manifest paths `src/services/combat/automation/...` are stale; live handler is `src/services/automation/handlers/class-warlock/fiendishResilienceHandler.js`).

Grep control evidence: `rg -n "_fiendishResilienceUsed" src/ --glob '!*.test.*'` → handler (read/write) + restRules-constants.js:246 inside LONG_REST_RESOURCES only. `rg -n "fiendish" src/services/rules/effects/restRules-shortRest.js` → zero hits.

## Notes
- Consumers are live and correct: `src/services/combat/automation/automationPassives.js:340` (hit-resolution resistance from chosenType), `src/services/rules/rulesFactory.js:188-192` (compute-time merge), `src/services/automation/index.js:484` routing. CharSummary shows the chosen type.
- If the once-per-long-rest gate were a deliberate design decision, the refusal text contradicts the feature text the app itself renders — at minimum a wording/state mismatch. RAW fix: reset `_fiendishResilienceUsed` on short rest too (or gate only "first acquisition"), keeping "until you choose a different one" semantics intact.
