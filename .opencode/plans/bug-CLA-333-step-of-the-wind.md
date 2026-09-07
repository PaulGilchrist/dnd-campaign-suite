# BUG CLA-333 — Step of the Wind (Monk base lv2, 2024) — FAIL

## Verdict: FAIL (BUG)

Feature data exists (`public/data/2024/classes.json` Monk lv2, automation type `step_of_the_wind`, cost focus_points 1, trigger `after_attack_action`, casting_time "1 bonus action") and the sheet row dispatches + spends Focus Points, but the **core mechanical outputs are prose-only** and the plain (no-FP) Dash mode is unobtainable.

## Test rig (live, 2026-09-06, test-campaign)
- Disciplined_Monk lv17 Warrior of Shadow (registry reuse, no edits to character).
- EB Thug joined; initiative walked to `activeCreatureName: "Disciplined_Monk"`.
- Sheet exposes only **"Heightened Step of the Wind:"** in Bonus Actions (base row removed by `src/services/character/classRules2024.js:150` `replacedByHeightened`).

## Clause results
- (a) BONUS ACTION: PASS (placement) — row renders under "Bonus Actions" header; data `casting_time: "1 bonus action"`. No turn/bonus-action-used enforcement exists but placement is correct.
- (b) PLAIN DASH (no FP): **FAIL** — no plain mode exists. Only the Heightened row is offered and `src/services/automation/handlers/combat/stepOfTheWindHandler.js` spends 1 FP unconditionally (no free-Dash branch). Live: click #1 spent FP (change-data `Disciplined_Monk.focusPoints` 17→16). No Dash state / extra-movement key written anywhere (`dash|dashing` grep = zero producers/consumers for this feature).
- (c) FOCUS-POINT UPGRADE: **FAIL** —
  - FP decrement real but **double-spends**: `src/components/char-sheet/useCharActionsAutomation.js:183-189` pre-spends 1 FP, handler spends again (`stepOfTheWindHandler.js` `setRuntimeValue(... 'focusPoints', currentFocus - cost ...)`). Live: click #1 net 17→16 (sheet full-store snapshot raced the handler's 15-write back up — popup printed "(15 Focus Points remaining)" while server settled at 16); click #2 net **16→14 (2 FP per click)** — same pattern as CLA-247 Patient Defense double-spend.
  - Disengage te: **MISSING** — no `targetEffects` written to change-data (per-char and top-level both empty post-click); `targetEffectDefinitions.js` has **no disengage/dash/jump entry**; grep `disengage|noOpportunityAttacks` shows no consumer for Step of the Wind (only addle/Open Hand + maneuver prose).
  - Doubled jump distance: **MISSING** — grep `jumpDistance|jump_distance|doubled.?jump` src+server = ZERO hits. Value never written. (Gridless movement is unmodellable, but the numeric doubled-jump state itself has zero producers — not just a display gap.)
- (d) EXPEND COUNTER REAL: PASS — `focusPoints` is a real change-data key: 17→16→14 across two clicks; FP=0 gate refusal live: popup "No Focus Points remaining.", FP held at 0, no new log entry.
- TRIGGER GATE `after_attack_action`: **ignored** — grep `after_attack_action` src+server = zero consumers; fires anytime.
- LOGGING: PASS — new `ability_use` log entries per activation ("Disciplined_Monk used Heightened Step of the Wind to Dash or Disengage as a bonus action...") ×2.

## Live control probes (both recorded)
1. FP=0 re-probe (sheet tracker fill 0 + Enter → server stamp `focusPoints: 0`; click row → refusal popup, FP stays 0, log unchanged) = gate real, consumption path real.
2. Click during own active turn with Thug in combat: FP consumed, zero te/movement/jump keys → effects are popup prose only.

## Root cause summary
`stepOfTheWindHandler.js` is popup+FP-spend only: no `targetEffects`, no dash/dash state, no jump multiplier, no trigger gate; sheet pre-spend duplicates the cost.

## Cleanup
Change-data + campaign log cleared via Admin after run; Thug removed. Character config unchanged (Warrior of Shadow lv17 as registry states).
