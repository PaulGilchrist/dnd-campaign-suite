# Bug — CLA-394 Zealous Presence: save-advantage clause inert (zero save-roll consumer); range gate never consulted

## Title
Zealous Presence grants real attack advantage but NO saving-throw advantage (buff `advantage_attacks_and_saves` has zero save-path consumers), and the 60-ft range gate is never consulted.

## Overview
CLA-394 Zealous Presence (Barbarian, Path of the Zealot lv10, 2024; `public/data/2024/classes.json` Barbarian majors[3].features[3]) activates end-to-end: `b.clickable "Zealous Presence:"` Bonus Actions row → handler `src/services/automation/handlers/class-barbarian/zealousPresenceHandler.js` → chooser (`zealousPresenceTarget` → `ZealousPresenceModal`) excludes self, caps at 10 (verified: clicked all 16 rows → exactly 10 checked, footer "Grant Advantage (10)") → confirm writes `activeBuffs` `{name:'Zealous Presence', effect:'advantage_attacks_and_saves', duration:'until_start_of_next_turn'}` per target + `addExpiration(..., expireOnCreatureName=barbarian)` + `ability_use` log. Uses latch (`zealousPresenceUses` 1→0) and rage-expend restore both fire live (re-click at uses=0 consumed ragePoints 6→5 and re-offered the chooser — RAW "expend a use of your Rage (no action)"). Already-active latch refusal works ("Zealous Presence is already active.").

Two gaps break the feature:
1. **Save half inert (core clause).** The buff effect `advantage_attacks_and_saves` has exactly ONE pipeline consumer — `src/services/automation/contextBuilder-sync.js:204` (`adv++` on the buffed creature's OWN next ATTACK). No saving-throw path reads it. `SavePromptModal.jsx` reads `targetActiveBuffs` at :202 but only matches `dodge`; `handleNpcSaveDamage.js:109` computes `advantage = hasSpellOrigin(...) || isCircleOfPowerActive(...)`; `handlePlayerSaveDamage.js:205` reads only `saveAdvantageCount`/`saveAdvantageAbilities` from computeConditionEffects (which has no branch for this buff). LIVE: buffed War_Cleric (buff present on change-data the same tick) saves vs Gazer 1 Frost Ray DC 12 DEX → `savePrompt-War_Cleric.advantage:false`, single d20 (17)+2=19 — no 2d20, no advantage marker anywhere on the save.
2. **Range gate never consulted.** The handler never imports/calls `isWithinRange`/`rangeToFeet`; the chooser lists ALL non-self combatants regardless of distance (all 15 others listed incl. far side). Gridless lenient would pass a *consulted* gate (CLA-378 precedent), but grep shows zero range producers for this feature — the "within 60 feet" clause is unenforceable even on a mapped rig.

## Expected (canonical quote)
"As a Bonus Action, you unleash a battle cry infused with divine energy. Up to ten other creatures of your choice within 60 feet of you gain Advantage on attack rolls and saving throws until the start of your next turn. Once you use this feature, you can't use it again until you finish a Long Rest unless you expend a use of your Rage (no action required) to restore your use of it."

## Actual
- Attack rolls of chosen allies: REAL advantage (popup "Adv (conditions)", `lastAttack.forcedMode:"advantage"`, log `roll|attack|ElderPaladin|rolls[7,18]|mode advantage` vs Thug 1).
- Saving throws of chosen allies: NORMAL single-d20 rolls; `savePrompt-<Ally>.advantage:false` while the Zealous Presence buff is on the ally's activeBuffs the same tick.
- 60-ft range: chooser unfiltered by distance; no `isWithinRange` call anywhere in the feature flow.
- Chooser also lists enemies (RAW-neutral "other creatures", but combined with no range gate = blanket grant).
- Buff `sourceCharacter` is written as the TARGET's own name (toggleBuff arg-order: `toggleBuff(targetName,'Zealous Presence',auto,campaign)` makes `sourceCharacter=playerName=target`) — cosmetic attribution gap.

## Steps (verified 2026-09-10, localhost:5173, dev detached per §46s)
1. Edit wizard DraconicDragon step 7 → Path of the Zealot (was Path of the World Tree — host drift again); trusted ✓Save; disk-verified (+16s).
2. EB-join Thug ×2 + Gazer 1; roll initiative; walk Next to DraconicDragon (array-order walk).
3. Click Bonus row "Zealous Presence:" → chooser (16 rows, no self) → cap test: tick ALL → exactly 10 stay checked.
4. Note: uses decrement happens at chooser-OPEN (handle() pre-spend), abandoning the picker leaks the use (§4 convention).
5. Pick ElderPaladin + War_Cleric → Grant Advantage → popup + `ability_use` log + per-target activeBuffs + barbarian-anchored pendingExpirations (appliedRound 1, expireOnCreatureName DraconicDragon).
6. Re-click row → refusal popup "Zealous Presence is already active."
7. Re-click at uses=0 with ragePoints 6 → ragePoints 6→5, chooser re-offers (rage-expend restore LIVE).
8. Buffed ElderPaladin attacks Thug 1 → 2d20 [7,18], mode advantage, forcedMode advantage ✓.
9. Buffed War_Cleric saves vs Gazer 1 Frost Ray DC12 DEX → SavePromptModal single d20 (17), `savePrompt-War_Cleric.advantage:false` — FAIL evidence.
10. Buff persisted through round 2 up to the barbarian's next turn (walk frozen there by ghost `pendingSaveListenerPrompts` entry — §42h/§55 family, unrelated defect; expiry registration itself is canonical CLA-345 shape).
11. Cleanup: Admin clear change-data (`{}`) + log (`[]`).

## Likely Location
- `src/components/common/SavePromptModal.jsx` :200-236 — buff scan matches only `dodge`; add an `advantage_attacks_and_saves` blanket branch against `targetActiveBuffs` (mirror Dodge block shape).
- `src/hooks/combat/handlers/handleNpcSaveDamage.js:109` — `advantage` misses the buff; `handlePlayerSaveDamage.js:205` likewise.
- `src/services/automation/handlers/class-barbarian/zealousPresenceHandler.js` — chooser targets built from combatSummary with no `isWithinRange(playerName, c.name, rangeToFeet(auto.range))` filter (CLA-378/CLA-357 recipe); fix `sourceCharacter` attribution by calling `toggleBuff(playerName, …, campaignName, targetName)` (buffToggle signature's 5th arg is the target).
- `src/services/combat/conditions/conditionEffects.js` — optional central seam: give `computeConditionEffects` an activeBuffs read for this effect so `saveAdvantageCount` badges AND rolls agree.

## Notes
- Manifest paths (src/services/combat/automation/…) fictitious as usual; real flow in src/services/automation/.
- Rest hygiene correct: `zealousPresenceUses` ∈ LONG_REST_RESOURCES (restRules-constants.js:166); `zealousPresenceActive` cleared on SR (:314) and LR (:132).
- Expiration anchor shape is correct for "until the start of your next turn" (creature-match leg fires at barbarian's NEXT-turn start, same-round guard `currentRound > appliedRound` kept buff alive through the rest of round 1 — observed live).
- Ghost save-prompt freeze (§42h family) blocked the final expiry walk; not attributed to this feature.
- Verdict basis: zero-consumer on a core clause ("advantage on saving throws"), grep-proved + live-proved single-d20 save while buffed = FAIL per verdict policy, not subset.
