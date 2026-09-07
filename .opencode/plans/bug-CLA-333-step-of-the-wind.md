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

## Fix options (2026-09-07 run — SKIPPED with partial clean fixes left in tree)

Reproduced live pre-fix (test-campaign, Disciplined_Monk lv17, existing initiative round 1): two clicks consumed **17→15→13 (2 FP per activation)**, popup/server raced, `targetEffects` empty, no expiration entries. Bug confirmed vs current code.

### FIXED cleanly (left uncommitted in tree, vitest+lint green, live re-verified)
1. **FP double-spend** — `useCharActionsAutomation.js` now excludes `auto.type === 'step_of_the_wind'` from the sheet pre-spend, mirroring the verified CLA-247 `patient_defense` exclusion (handler is sole FP writer; gate + spend + popup arithmetic all live in `stepOfTheWindHandler.js`). Handler now also dispatches `focus-points-updated` after its awaited spend (mirrors patientDefenseHandler:17), removing the §6-#18 full-store snapshot race. Fixes BOTH rulesets in one stroke — 5e `classes.json:6557` uses the same `step_of_the_wind` type + same handler + same pre-spend seam.
   Live post-fix: click #1 13→12, click #2 12→11 (exactly 1 each), popup matched server both times; FP=0 gate still refuses ("Not enough Focus Points. 0/1 required." — handler is now the sole gate; sheet's "No Focus Points remaining." no longer fires for this type), FP stayed 0, no spend, no log entry.
2. **Disengage targetEffect** — handler now writes self-target `no_opportunity_attacks` te (`duration: 'until_start_of_next_turn'`) + `addExpiration remove_target_effect` with `expireOnCreatureName = monk` (mirrors patientDefense Dodge expiration + executeManeuver self-te patterns). **Correction to this report:** `targetEffectDefinitions.js:123` DOES register `no_opportunity_attacks` (label/icon/group present) and it HAS live consumers — `conditionEffects.js:408→riderCannotOpportunityAttack`, "No OA" badge in `ConditionEffectBadges.jsx:214` (removable) and `MonsterCardBody.jsx:24`. Live post-fix the "No OA" badge rendered on the monk with the te + expiration in change-data. Log updated to state the effect. This is the app's disengage model (badge-guided GM enforcement) — no new infrastructure.
   Tests: `stepOfTheWindHandler.test.js` (+CLA-333 block: single FP write=1, te append shape, expiration registration, event dispatch, FP=0 inert) and `useCharActionsAutomation.test.js` (+CLA-333 sheet non-pre-spend + FP=0 pass-through). Folder suites `handlers/combat` + `char-sheet`: 6865 passed; lint zero warnings.

### SKIPPED clauses (need movement-model decision — do not half-fix)
3. **Plain (no-FP) Dash mode** — row text promises "Take Dash as Bonus Action, OR expend 1 FP for…". No free branch in handler; CLA-247's precedent auto-upgrades when FP available (free mode only at FP=0), and the app offers a generic `bonusActionChoiceModal` mechanism (BonusActionChoiceModal + applyBonusActionChoice) that COULD host a Dash/FP-mode picker — but no verified feature uses it for a cost-vs-free split, and adding a chooser changes activation UX + FP=0 clause (d) semantics. Option A: auto-pattern like patient_defense (FP=0 → free Dash, FP≥1 → upgrade) — near-zero cost but plain mode still unobtainable at FP>0. Option B: bonusActionChoice picker — honest both-modes but new UX pattern + expiry split (Dash-only has no te today). Decision needed: does this app intend to model free Dash at all (no dash state exists app-wide)?
4. **Doubled jump distance** — grep `jumpDistance|jump_distance` = zero producers AND consumers; gridless app, no movement state keys anywhere. Requires a numeric movement-state model. Not cleanly fixable; keep as popup prose until a movement model exists.
5. **Dash numeric state** — same as (4): no dash/extra-movement key exists app-wide (only `lungingAttack`/`baitAndSwitch` named latches). Fix rides on the same movement-model decision as (3).
6. **`after_attack_action` trigger gate** — mechanism exists only for `after_attack_action_with_polearm` (bonusActionAttackHandler.js:65 via `findLastAttack`) and `after_casting_action_spell` (sheet `lastActionSpellCast` stamp). `findLastAttack` has NO turn scoping (CLA-335 note), so gating SoW on it would false-refuse legitimate non-combat/first-activation uses; a correct gate needs an "Attack action taken this turn" producer, which doesn't exist. Option: stamp `lastAttackActionRound` at the base Attack action + gate handler on same round — new producer, needs its own verification. Not done.

### Verdict
PARTIAL: FP double-spend + disengage te FIXED cleanly (tests green, live-verified, Admin Full Reset done). Dash/jump/plain-mode/trigger-gate remain inert pending a gridless-movement-model decision → overall SKIPPED. Manifest row CLA-333 intentionally untouched (owner to update).
