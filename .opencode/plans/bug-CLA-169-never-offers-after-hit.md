# CLA-169 Hill's Tumble (Goliath / Hill Giant) — FAIL: never offers after a melee hit (attempt 2, live E2E)

## Title
CLA-169 Hills Tumble never offers/fires: melee HIT lands with lastAttack.hit:true but no prompt, no te, no hillsTumbleUses decrement, no automation/ability_use log; gate chain also lacks .hit check (fires-on-miss family bug, static).

## Overview
Attempt 2 retry. ElderPaladin (Goliath, Hill Giant subrace — disk-verified `race.subrace.name = "Hill Giant"`, Paladin lvl 20, proficiency +6, Longsword equipped) attacked Bandit 1 in initiative (EB join, round 1) via the working attack seam: sheet Actions expand -> attack row `.clickable` '+11' -> dice popup -> Done -> damage popup -> Done. The attack HIT (d20 6 +11 = 17 vs AC 12; 19 damage; Bandit 1 19 -> 0). change-data confirmed `/lastAttack.hit:true`, `weaponType:'melee'`, `targetName:'Bandit 1'`. Despite a fully valid trigger, NO Hills Tumble offer appeared: no popup after the damage Done, no prompt on the initiative card, no feature chip anywhere. Clicking the sheet's `Hill's Tumble:` clickable texts (feature description header and uses-counter block) produced no popup and no dispatch. The uses counter stayed 6/6; no `hillsTumbleUses` key in change-data; Bandit 1 change-data held only `pendingExpirations` (no `disadvantage_next_attack` te); campaign log had zero `ability_use`/`automation`/`condition applied` entries (only encounter, Initiative roll, 2 Longsword rolls, hp_change). Per mission rules: never-offers = FAIL.

## Expected Behavior (canonical app-data wording, public/data/2024/races.json via sheet)
"When you hit a Large or smaller creature with an attack roll and deal damage to it, you can give that creature Disadvantage on its next attack roll before the end of its next turn. You can use this a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest."

## Actual Behavior (observed live)
- HIT registered: change-data `lastAttack = {attackerName:'ElderPaladin', targetName:'Bandit 1', d20:6, bonus:11, total:17, targetAc:12, hit:true, weaponType:'melee'}`; `ElderPaladin.lastAttackRoll.hit:true`.
- After clicking Done on the dice popup AND the damage popup: popup stack empty, no Hills Tumble offer, no selection UI, no refusal popup either.
- Sheet shows a static resource row "Hill's Tumble: 6/6 (cur/max)" (CharRaceFeatures.jsx:31 `resourceKey:'hillsTumbleUses'`) — display only; clicking it is just the spinbutton, no use popup.
- Clicking `Hill's Tumble:` clickable feature header in Actions list: no popup, no log.
- No `hillsTumbleUses` decrement (UI stays 6/6; key absent from change-data); no te on Bandit 1; log contains no automation/ability_use/condition entries.

## Steps to Reproduce
1. localhost:5173 -> select test-campaign -> Encounters -> tick Bandit -> Join Encounter.
2. Initiative -> arm ElderPaladin card target-select = Bandit 1 (native-setter change).
3. Sidebar ElderPaladin -> sheet -> expand Actions -> click Longsword '+11' clickable -> attack rolls -> Done (dice) -> Done (damage). Attack HITs (19 dmg).
4. Observe: no Hills Tumble offer appears at any point; sheet counter remains 6/6; change-data/log show no hills_tumble activity.
5. Click sheet 'Hill's Tumble:' feature text and uses-counter block: nothing happens.

## Likely Location
- No consumer offers hills_tumble post-hit: `grep melee_hit src/services` -> zero consumers (attempt 1 finding, reconfirmed live). `src/services/combat/automation/automationRouter.js:218` assigns `routeFireBurn` to `['fire_burn','frosts_chill','hills_tumble']` but routeFireBurn only buckets by casting_time; nothing evaluates `trigger:'melee_hit'` to surface the offer after an attack resolves.
- Handler plumbing exists but is never reached from the attack pipeline: `src/services/automation/handlers/class-other/giantAncestryDispatch.js:109 handleHillsTumble`, `giantAncestryTraits.js:131 handleHillsTumbleDirect`, registered `src/services/automation/index.js:512` — no UI path constructs the `action.automation.type='hills_tumble'` action.
- Static family-bug also present: `src/services/automation/handlers/class-other/giantAncestryUtils.js:181 attackerRollGate` checks lastAttack existence/attacker/rollType/target but has NO `.hit` check — if the offer were wired, it would fire on misses too (same shape as CLA-141/CLA-148).
- LR reset exists (`src/services/rules/effects/restRules-longRest.js:731 ['hillsTumbleUses', null]`) but untestable since uses never decrement.
- Row manifest paths in mission JSON (`combat/automation/handlers/classFeatureHandler.js` etc.) are stale; real files are `automation/handlers/class-other/giantAncestry*`.

## Notes
- Attempt 1 (incomplete-CLA-169-attack-affordance-unreachable.md) blocker RESOLVED: attack seam found and works (sheet Actions -> '+11' .clickable -> full pipeline). This attempt completed the HIT trigger scenario and the automation demonstrably never offers/fires -> upgraded INCOMPLETE to FAIL.
- Cleanup done: admin clear-change-data + clear-log; verified change-data == {} and log == [].
- Control evidence: valid hit produced zero delta on `hillsTumbleUses` and Bandit 1 targetEffects.
- Character left in final useful config: ElderPaladin, Paladin (Oath of the Ancients) lvl 20, Goliath / Hill Giant.
