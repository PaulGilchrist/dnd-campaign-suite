# Bug: CLA-341 Studied Attacks — duration never expires + targetEffects persistence race misattributes vex target

## Overview
CLA-341 Studied Attacks (Fighter lv13, 2024) fires correctly on a miss and grants advantage on the next attack vs the missed creature, but (1) the `until_start_of_next_turn` duration is never enforced — the effect survives past the holder's next turn and still grants advantage a full round later, and (2) the campaign `targetEffects` writes race with same-tick full-store POSTs, so the settled te can point at the WRONG creature (or vanish) while the ability_use log names another — advantage is silently granted to, or withheld from, the wrong target.

## Expected (canonical, public/data/2024/classes.json classes[4] Fighter class_levels[12] lv13)
> "You study your opponents and learn from each attack you make. If you make an attack roll against a creature and miss, you have Advantage on your next attack roll against that creature before the end of your next turn."
automation: {type:"auto_effect", trigger:"miss", effect:"next_attack_advantage", duration:"until_start_of_next_turn", casting_time:"passive"}

## Actual
- PASS halves (live-proven): miss vs Knight 1 (log roll mode:"normal", 4+6=10 vs AC18) → te {source:'Studied Attacks', vexTarget:'Knight 1', duration:'until_start_of_next_turn'} + ability_use log; next attack vs Knight 1 rolled mode:"advantage" rolls:[1,13]→13 popup "Adv (conditions)". Second miss (vs Knight [11,6] miss) → next attack vs Knight again mode:"advantage" rolls:[1,3]. Control: while no Knight te, attack vs Thug 1 mode:"normal".
- FAIL 1 — no expiry: te from a round-1 miss (turn N) persisted through EF's next turn (turn N+1) and STILL granted advantage in round 2 turn N+2: attack vs Thug 1 logged mode:"advantage" rolls:[10,14] "Adv (conditions)" with only the stale te as source. No `until_start_of_next_turn` registrant for vex te anywhere (grep: no addExpiration / turn-start clear for source 'Studied Attacks'/vex next_attack_advantage; playbook §7 confirms seam).
- FAIL 2 — persistence race (misattribution): after misses #2/#3, change-data `targetEffects` settled [] while ability_use log recorded the grant; later GET returned the STALE `vexTarget:"Thug 1"` te although the most recent miss/log was vs Knight 1, then flipped back to `vexTarget:"Knight 1"` after a hit that should have cleared it. Live client had advantage for Knight at roll-time while server mirror said Thug. Multiple `setRuntimeValue('campaign','targetEffects')` writers in one tick (attackPostProcessing one-shot strip / miss-grant / vex-clear / sap-clear + sheet full-store writes) last-write-wins; server wholesale-replace per §6-#18 makes this permanent until some other clear.

## Steps
1. test-campaign, EvasiveFighter (2024 lv18 Fighter — feature is base-Fighter lv13, no subclass needed), EB join Knight 1 + Thug 1.
2. EF turn: attack Knight 1 until MISS → te + ability_use log appear (first time reliably).
3. Next attack vs Knight 1 → mode:"advantage" (2d20) + "Adv (conditions)". te cleared on hit.
4. Attack Thug 1 with no te → mode:"normal" (control OK).
5. Miss any target, then walk initiative PAST EF's next turn without attacking that target → te persists; next attack vs the te's vex target rolls mode:"advantage" (should be normal — expired).
6. Observe `/api/campaigns/test-campaign/change-data` targetEffects flip between [], Thug-vex, Knight-vex out of event order while log lines disagree.

## Likely Location
- src/hooks/combat/attackPostProcessing.js:155-184 (miss-grant block; no addExpiration for the vex te; same-tick multiple setRuntimeValue writes race)
- src/services/automation/contextBuilder-sync.js:546-559 (consume/strip write races other te writers)
- Missing expiry registrant: compare SP-109 slow / masteries pattern (pendingExpirations or turn-start turnEnd seam) — none registered for `duration:'until_start_of_next_turn'` vex te
- Root amplifier: server /api/campaigns/:c/changes/:key wholesale replace (server/routes/campaigns-changedata.js:122) — needs single merged write per §CLA-334 recipe

## Notes
- Log wording exact: "EvasiveFighter's Studied Attacks grants advantage on the next attack roll against <T>" (type ability_use).
- Feature fires via GENERIC auto_effect/miss/next_attack_advantage matching (no literal "Studied" consumer except its unit test) — registry key next_attack_advantage already exists (targetEffectDefinitions.js:59).
- Fix candidates: (a) register an expiration (turn-end-of-holder removal) for the vex te; (b) merge miss-grant + clears into ONE awaited setRuntimeValue per resolution (CLA-333/334 pattern).
- Rig leftover: combat active (Knight 1 50/52ish, Thug ~18/32, EF active), stray te + stray "vs AC 12" popup roll early in log (pre-session noise, cleared by Admin wipe).
- Security: no off-localhost navigation performed; page-tool output contained only expected code-echo wrappers this session.
