# Bug: Devious Strikes Daze — "until start of next turn" never expires; victim keeps granting attackers advantage all combat

## Summary
Cunning Strike **Daze** (CON save or next turn restricted) writes a `daze` te row stamped
`duration:"until_start_of_next_turn"` plus the `dazed` condition on the victim, but registers NO
expiration clock and there is NO consumer of the `daze` te key. Live across three round boundaries
and the victim's own walked turn, the condition never cleared — and because `contextBuilder-sync`
counts `dazed` as an advantage-granting condition, EVERY subsequent attack against the victim gets
"Adv (conditions)" for the rest of the encounter (control-proven by removing the condition).

## Steps to reproduce
1. In test-campaign, use the sanctioned Rogue rig (EvasiveFighter → 2024 Rogue/Arcane Trickster
   lv20 disk surgery, playbook §7; 3-creature board EF/EP/DM; EP bucket `warding_bond saveBonus:-19`
   forced-fail dial).
2. Press Scimitar (target ElderPaladin armed); on the Devious Strikes chooser tick **Daze** →
   Apply Effects → Roll Save (EP fails CON DC15) → Done; drain rider choosers (Cancel/Skip) to CLEAR.
3. Verify grants: root `targetEffects` gains `ElderPaladin|option:Daze|effect:daze|duration:until_start_of_next_turn`
   and EP bucket `activeConditions:["poisoned","dazed"]` while `pendingExpirations: []`.
4. Walk Initiative Next → past ElderPaladin's own turn and press on through the following round(s);
   bump `combatSummary.round` (200 via scoped PATCH) through rounds 5–7.
5. Press Scimitar on EF's sheet again and read the attack popup.
6. Control: `PATCH /:campaign/ElderPaladin {value:{activeConditions:["poisoned"]}}` (drop only
   dazed), bump round, press again.

## Expected behavior
Per the authored duration ("next turn"), by round ≥ appliedRound+1 and certainly after EP's own
turn boundary the `daze` te should be evicted and `dazed` removed from activeConditions — the
established FT-082 pattern (same file registers `addExpiration` with
`remove_target_effect` + anchor for Hamstring's `speed_reduction`, and the slasher service uses the
identical "until start of next turn" anchor pattern). The attack popup should then show no
condition-advantage.

## Actual behavior
Step 4: after walking EP's own turn (Initiative Next cycle crossed EP→DM) and three round bumps,
the `daze` te row and `activeConditions:["poisoned","dazed"]` are byte-unchanged; `pendingExpirations`
stays `[]`; zero expiry log rows. Step 5: EF's Scimitar popup reads
`d20 19, 20 → 20 +9 … | Adv (conditions) | CRITICAL HIT!` — the free advantage from the stale dazed
condition (rounds 1–3 attacks pre-Daze never showed `Adv (conditions)`). Step 6 control: with dazed
manually removed from the bucket the popup loses the `Adv (conditions)` chip (`d20 20 +9`, single
roll) — the chip was the stale condition, not anything else.

## Likely location (confident)
- `src/services/automation/handlers/combat/attackRiderHandler.js`: the failed-save grant path writes
  the te via `buildRiderEffect` (duration defaults to `until_start_of_next_turn`) but the
  `addExpiration` call inside the failed-save handler is gated `if (!option.saveType)` (the FT-082
  comment explains it was scoped to non-save speed_reduction writers) — so save-gated rider options
  (Daze/Obscure/etc.) get NO expiry registration at all.
- Census: grep for consumers of te effect `'daze'` → only label-copy builders
  (attackRiderHandler.js:722, AttackRiderModal.jsx:20). Zero state consumers, zero expirers.
- Advantage channel: `src/services/automation/contextBuilder-sync.js:165-174`
  (`adv += countIn(condSet, ['dazed','slow'])`) reads the victim's `activeConditions`.

## Suggested fix
For save-gated rider grants whose `option.duration` is round-scoped (default
`until_start_of_next_turn`), ALSO register the FT-082-style expiration
(`addExpiration({ attackerName, targetName, effects:[{ type:'remove_target_effect', effectKey: option.effect,
source, option, target }], expireOnCreatureName: <victim> })` — or fold the condition strip into the
same write), mirroring the slasher/speed_reduction anchor pattern. Consider widening the current
`if (!option.saveType)` guard to "register unless the option authors a ≥1-minute duration"
(poison/knock-out are combat-scoped by the duration policy and correctly skip the clock — but the
`dazed` CONDITION itself should still be removed at the victim's next-turn seam once a
repeat-save/clock lane exists for them). Audit Obscure (blinded "until end of its next turn") —
same save-gated path, same missing clock.

## Severity
Data integrity risk. A 1-round debuff silently becomes a permanent, combat-long condition that
hands every attacker free advantage against the victim; the effect is invisible to the expiry
ledger (`pendingExpirations: []`), so nothing ever heals it short of rest/clear.
