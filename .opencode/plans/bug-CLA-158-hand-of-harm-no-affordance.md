# BUG — CLA-158 Hand of Harm: reaction never offered (inert affordance)

## Title
CLA-158 Hand of Harm (Warrior of Mercy lv3 reaction): qualifying hit commits but NO reaction affordance appears anywhere; no CON save, no Focus Point spend, no necrotic damage, no logs — FAIL(b) inert consumer seam.

## Overview
Standalone Hand of Harm reaction lane is unreachable in the live app. A Bandit in initiative (target armed on the sheet, adjacent-lenient gridless) HIT Disciplined_Monk (d20 19 +3 = 22 vs AC 22, `lastAttack` persisted `hit:true`, `hp_change` logged on the monk). After that commit, no "Hand of Harm" chip/link/prompt exists in the initiative view or on the monk's character sheet — the feature renders as inert class-feature prose only. A control click on the prose DIV produced zero delta (log length unchanged 10→10, no `saveResult-*`, no `focusPoints`, no `targetEffects`, Bandit 1 still 11 HP).

The handler itself is real code and registered (`reaction_damage: handleReactionDamage`, src/services/automation/index.js:336; routed into `result.reactions` at src/services/combat/automation/automationRouter.js:220-225; infoBuilder scales lv17+ → 3d6, saveDc from WIS, src/services/combat/automation/automationInfoBuilder/reaction.js:48-68) — but no UI seam ever collects/offers this reaction after `creature_within_5ft_hits_on_attack_roll`, so `handle()` is never invoked for Hand of Harm. Same "reaction never offered" shape as the CLA-144 harm-leg precedent.

## Expected Behavior (canonical 2024 classes.json Warrior of Mercy lv3)
"When a creature you can see within 5 feet of you hits on an attack roll, you can take a Reaction to channel supernatural poison through that creature. The creature must succeed on a Constitution saving throw against your spell save DC or take 1d6 Necrotic damage and have Disadvantage on the next attack roll it makes. This Necrotic damage increases to 2d6 at level 11 and 3d6 at level 17."
automation: `{type:'reaction_damage', trigger:'creature_within_5ft_hits_on_attack_roll', damageExpression:'1d6', damageType:'Necrotic', saveType:'CON', saveDc:'ability', scaling:{11:'2d6',17:'3d6'}, resourceCost:'focus_point', alsoInflicts:'disadvantage_next_attack', casting_time:'1 reaction'}`

## Actual Behavior
- After the committed hit: initiative view DOM = zero elements matching /Hand of Harm/ (only target selects/HP). No reaction prompt/popup.
- Monk character sheet: HoH appears only as a plain prose DIV inside class-features text; clicking it: log 10→10 entries, 0 ability_use, 0 Necrotic roll, 0 hp_change to Bandit (stays 11/11).
- change-data post-hit: `focusPoints` key ABSENT (never written), `saveResult-Bandit 1` ABSENT, `targetEffects` ABSENT. Only `lastAttack` present (from the bandit's own attack).

## Steps to Reproduce
1. test-campaign → Encounters → search "Bandit" → tick Bandit → Join Encounter (joins as "Bandit 1", ini 16).
2. Initiative view → Bandit 1 card Target select → Disciplined_Monk.
3. Open Bandit 1 avatar card → press Scimitar dice chip (`mc-dice-link`) until HIT → real-pointer click `button.dice-roll-reroll-btn` "Done" (hp_change commits, lastAttack hit:true).
4. Observe initiative view + open Disciplined_Monk sheet: no Hand of Harm affordance ever; click HoH prose → nothing.

## Likely Location
- Missing seam: src/components/initiative/ (initiative.jsx / CreatureCard.jsx) — no post-hit reaction-prompt consumer; src/components/char-sheet/CharReactions.jsx `appendDynamicReactions` reads `playerStats.automation?.reactions` but the monk's built stats never surface Hand of Harm as a pressable chip (sheet shows prose only, verified live).
- Where the fix lands: route `result.reactions` (automationRouter.js:220-225 includes `'reaction_damage'`) → playerStats → a clickable affordance armed by `lastAttack.targetName === holder && lastAttack.hit && within 5ft`, then executeHandler→handleReactionDamage.
- Handler secondary bug to fix in the same pass: src/services/automation/handlers/reactions/reactionDamageHandler.js:86-90 `skipFP = isHandOfHarm && hasFlurryHealingHarm` skips the Focus Point cost for EVERY Hand of Harm press once lv≥11, not only when the triggering strike was part of Flurry of Blows — standalone HoH would charge 0 FP (RAW: 1 FP) once the affordance exists.
- Stale manifest paths (row JSON): `src/services/combat/automation/handlers/classFeatureHandler.js`, `.../routers/classFeatureRouter.js`, `.../infoBuilders/classFeatureInfoBuilder.js` do not exist; real files are the automationRouter / automationInfoBuilder / services/automation handlers cited above.

## Notes
- Control probe: prose-DIV click zero delta (log count, focus, saves, te, Bandit HP all unchanged) — proves inert, not misclicked.
- CLA-144 (flurry free-replacement lane) remains separately filed broken; this row is the STANDALONE reaction and fails independently (never offered at all).
- save branch of handleReactionDamage also has NO trigger/adjacency/reaction-spent gate (gates exist only in the no-save melee branch) — relevant once an affordance is added.
