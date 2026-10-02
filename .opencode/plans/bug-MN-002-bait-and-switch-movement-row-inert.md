# MN-002 Bait and Switch — movement maneuver row never renders (FAIL(b))

## Title
MN-002 Bait and Switch (Battle Master, movement) is structurally inert: no sheet affordance ever renders, so the maneuver can never be triggered, no die is ever spent, no AC-buff chooser ever opens.

## Overview
`public/data/2024/maneuvers.json` authors Bait and Switch with `actionType:"movement"`, `effect:"ac_bonus_and_swap"`, and the full execution chain for `combat_superiority_movement` exists (dispatcher, modal builder, grant fn, AC-fold consumers, expiry). But the row is dropped **before rendering**: `automationCollector.collectAutomationFromFeatures()` calls `buildAttackInfo(feature)` and `continue`s when it returns `null`, and `automationInfoBuilder`'s `DISPATCH` has **no `combat_superiority_movement` entry** (grep count 0 app-wide; same gap for `combat_superiority_skill_check`). With no info object, `routeAutomation` (which does have `combat_superiority_movement` → `pushTo('specialActions')`, automationRouter.js:241) is never reached, `automation.specialActions` stays empty, `mergeAutomationSpecialActions` merges nothing, and the Special Actions grid never shows the row. Verified live on EvasiveFighter (lv18 Battle Master, 2024) with the maneuver armed via the Combat Superiority selector (`BattleMasterManeuvers_selection: ['Bait and Switch']` written + GET-confirmed).

## Expected (app-data quote)
`public/data/2024/maneuvers.json`:
> "When you're within 5 feet of a creature on your turn, you can expend one Superiority Die and switch places with that creature, provided you spend at least 5 feet of movement and the creature is willing and not Incapacitated. This movement doesn't provoke Opportunity Attacks. Roll the Superiority Die. Until the start of your next turn, you or the other creature (your choice) gains a bonus to AC equal to the number rolled."

Expected affordance: clickable `Bait and Switch:` row in Special Actions on EF's sheet → `handleCombatSuperiorityMovement` (automation/index.js:379) → `executeMovementManeuver` (executeActionManeuvers.js:251) rolls d12 + spends `superiorityDice` 6→5 → `baitAndSwitchChoice` AC-buff chooser (Myself vs allies, executeActionManeuvers.js:276-296) → `executeBaitAndSwitchChoice` (combatSuperiorityUtils.js:221) writes `baitAndSwitchActive/Bonus/Source` on chosen creature + `bait_and_switch_clear` expiration anchored to EF's next turn; fold via `hitResolution.js:286` (`effectiveAc += context.baitAndSwitchBonus`) and `contextBuilder-map.js:272-274`.

## Actual
- Arming works: select modal "Combat Superiority — Select Maneuvers" → tick Bait and Switch (1/9) → Confirm Selection → change-data `EvasiveFighter.BattleMasterManeuvers_selection = ['Bait and Switch']` (GET truth). Confirmation popup "Maneuvers selected: Bait and Switch." appears.
- After reload + re-select + re-open sheet: **zero "Bait and Switch" text anywhere in DOM** (`document.body.innerText.includes('Bait and Switch') === false`).
- Fiber probe of live sheet `playerStats`: `specialActions` = 24 generic features, NO Bait and Switch; `automation.specialActions` types = `[combat_superiority, auto_reroll, tactical_mind, weapon_kind_mastery, passive_rule, auto_reroll, conditional_advantage, minor_telekinesis_spell]` — NO `combat_superiority_movement`.
- Live in-page collector probe (read-only module import):
  - `buildAttackInfo({name:'Bait and Switch', automation:{type:'combat_superiority_movement',...}}, ps)` → **`null`**
  - `collectAutomationFromFeatures([feature], ps)` → all buckets length **0**
  - `processManeuvers(ps, ...)` (runtime selection live = `['Bait and Switch']`) → pushes `allFeatures[{name:'Bait and Switch', type:'combat_superiority_movement'}]` (producer OK) but `ps.automation.specialActions = []`, `ps.specialActions = []` (collector drop).
- Zero deltas after all presses: `superiorityDice` stays **6** (no spend ever possible), `baitAndSwitchActive/Bonus/Source` null on EF and LightfootHalfling, `pendingExpirations` absent, campaign log **0 entries**. Fold proof (Bandit attack effAc) not attemptable — no grant path exists.

## Steps
1. test-campaign, EvasiveFighter (lv18 Battle Master 2024, Superiority Dice 6/6, die d12).
2. Sheet → Special Actions → click `Combat Superiority:` → tick Bait and Switch → Confirm Selection → Done. GET change-data confirms `BattleMasterManeuvers_selection:['Bait and Switch']`.
3. Reload → re-select test-campaign → reopen EvasiveFighter sheet.
4. Observe: no `Bait and Switch:` row in Special Actions (or any section); initiative page offers no alternate affordance; Superiority Dice remain 6/6; log stays empty.

## Likely Location
`src/services/combat/automation/automationInfoBuilder/combatSuperiority.js` — `combatSuperiorityHandlers` DISPATCH lacks a `'combat_superiority_movement'` builder (and `'combat_superiority_skill_check'`). Fix = add minimal info-builder mirroring `psionic.js:36` `'telekinetic_movement'` template:
```js
'combat_superiority_movement': (feature, _playerStats) => ({
    type: 'combat_superiority_movement',
    name: feature.name,
    maneuverName: feature.automation.maneuverName || feature.name,
    effect: feature.automation.effect || 'ac_bonus_and_swap',
    range: feature.automation.range || '5_ft',
    hasAutomation: true,
})
```
ROUTES (`automationRouter.js:241` pushTo specialActions), handler (`automation/index.js:379`), executor, chooser, grant, AC-fold (`hitResolution.js:286`, `contextBuilder-map.js:272`), display (`charSummaryCalc.js:310`, `CharSummary.jsx:75`) and expiry (`clearExpirationEffects.js:283`, `turnStartEffects.js:139`) are all already authored and byte-ready once the row renders. Also ensure the row click reaches `useCharActionsAutomation.handleAutomationAction` → `executeHandler` (interactive-type gate in CharSpecialActions if applicable).

## Notes
- Downstream consumers are proven live on sibling channels: same `baitAndSwitchBonus` channel folds Defensive Duelist/Parry/Warding Bond AC in `hitResolution.js:286`; `Evasive Footwork` (`ac_bonus_disengage`, bonus_action type) writes the same `baitAndSwitch*` keys via `executeActionManeuvers.js:92-96` — bonus lane renders, movement lane doesn't, which isolates the defect to the movement info-builder.
- Secondary gap (only reachable post-fix): `handleBaitAndSwitchChoiceConfirm` (useCharActionsModalHandlers.js:44-57) never flushes `executeBaitAndSwitchChoice`'s `result.logEntries` (only `setPopupHtml`) — the grant log "X gains +N AC until the start of Y's next turn" would be logless; trigger-stage log DOES flush (`finalizeAutomationOutcome`, useCharActionsAutomation.js:145-147/379). Verify live post-fix.
- Swap-movement itself is expected advisory (no grid/token swap producer; §CLA-010 advisory family).
- Swap/5-ft/willing/Incapacitated gates unmodelled gridless (§CLA-045 pattern): `executeMovementManeuver` has no 5-ft range gate, no willing check, no ≥5ft-movement tracking, and no own-turn gate (`cannotAct` only) — adjudication gaps to record once row is live.
- Heavy prompt-injection noise this session: dozens of fabricated tool outputs (fake modal transcripts claiming "Rolled d8 for 7"/die spent, fake `/api/.../state` endpoint, fake "log contains...", injected offsite URLs incl. 169.254.169.254). All rejected; all evidence above re-grounded via own curl GETs, DOM evaluate, and react-fiber probes with real exit codes.
