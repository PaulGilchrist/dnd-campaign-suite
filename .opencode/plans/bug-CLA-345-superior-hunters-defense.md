# BUG CLA-345 — Superior Hunter's Defense (Ranger, Hunter major lv15, 2024)

**Verdict: FAIL (wrong duration — resistance never expires) + no reaction-pool spend + same-hit refire.**
Core chain live (row, gate, resistance, same-turn halving, post-damage heal per CLA-335 model) but the "until end of current turn" limit is unenforced.

## Canonical
2024 classes.json Hunter major lv15: "When you take damage, take Reaction to give yourself Resistance to that damage and any other damage of the same type until end of current turn." automation `{type:"superior_hunter_defense", casting_time:"1 reaction"}` (public/data/2024/classes.json ~:9033).

## Consumers (all live)
- `src/services/combat/automation/automationInfoBuilder/core-handlers.js:292` (info builder)
- `src/services/combat/automation/automationRouter.js:445` → `result.reactions` (sheet row)
- `src/services/automation/index.js:129,438` → handler map
- `src/services/automation/handlers/class-ranger/superiorHunterDefenseHandler.js` (full handler: lastAttack gate, retro heal, activeBuffs `damage_resistance` + `resistanceTypes`)
- `src/services/rules/combat/applyDamage.js:201-202` — reads `buff.resistanceTypes` → halving consumer.

## E2E evidence (test-campaign, FeyRanger lv17, subclass switched Gloom Stalker→Hunter via Edit wizard tab 7 + Save, disk verified, Long Rest)
1. Row `Superior Hunter's Defense:` clickable in Reactions. Pre-damage click refused: popup "No recent attack found…" (targetName gate OK).
2. Thug 1 (EB, Mace 1d6+2 bludgeoning) HIT: hp_change delta -3, no reduction. Reaction click → popup "You gained Resistance to bludgeoning damage until end of current turn… Retroactively healed for 1 HP", hp_change +1 isHealing sourceName=SHD, ability_use log exact. POST-damage HEAL model (CLA-335 established), accepted.
3. Same-turn 2nd bludgeoning hit: hp_change delta -2, `damageBreakdown[{bludgeoning, resisted:true, status:'resistant'}]` — HALVED live (CLA-336 method). PASS.
4. **FAIL — duration**: buff `activeBuffs[{name:'Superior Hunter's Defense', effect:'damage_resistance', duration:'until_end_of_current_turn', resistanceTypes:['bludgeoning']}]` persists after turn advance: Thug 2's OWN turn next hit still `resisted:true` delta -4 (83 HP). Handler (superiorHunterDefenseHandler.js:72-80) never enqueues `addExpiration`/pendingExpirations and no turn-end sweeper clears this buff → resistance is permanent until manually removed or re-applied.
5. **FAIL — no reaction gate**: no FP/reaction-pool or uses key consumed anywhere (focusPoints untouched; handler writes no latch). Refire proven: second click on same triggering lastAttack re-healed +2 (85→87) same turn — CLA-335 family latch gap (`_Superior_Hunters_Defense_usedRound` absent from initiative.jsx/navigationHandlers.js clear lists).
6. Control: pre-damage refusal + non-target gate code-verified (handler :13-35). Different-damage-type same-turn control not buildable (EB Thug = bludgeoning only) — `resistanceTypes:['bludgeoning']` scoped structurally, live unproven.

## Fix recipe (per CLA-335/CLA-336 recipes)
- Enqueue expiration in handler: `addExpiration`/pendingExpirations `expireOnCreatureName:<activeCreatureName>` (stamp from fresh getCombatContext) so buff clears at triggering turn's end; or add buff name to the turnStartEffects.js activeBuffs filter family (~:221 cloak precedent).
- Add `_<Feature>_usedRound` latch beside `_Slow_Fall_usedRound` in initiative.jsx + navigationHandlers.js clear lists; refuse same-round re-click with `<feature>_refused` log.
- Post-damage HEAL model: accepted app-wide, do not rebuild pipeline.

## Cleanup
Initiative cleared, EB thugs removed, Admin cleared change-data + log; server up on :80/:5173. **LEFTOVER: FeyRanger subclass = Hunter lv17 (was Gloom Stalker) — permanent on disk.**
