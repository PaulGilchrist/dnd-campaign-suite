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

## Resolution
FIXED 2026-11-07. Root cause confirmed exactly as diagnosed: `handleRiderSave` (the failed-save
leg in `attackRiderHandler.js`) grants `option.condition` and keeps the descriptor te row but
registered NO expiration — the only rider clock (FT-082 in `logSpeedReduction`) is gated
`if (!option.saveType)`, so every save-gated round-scoped rider (Daze/Obscure) armed
`pendingExpirations: []` and the condition stood forever, feeding the
`Adv (conditions)` channel in `contextBuilder-sync`.

Fix (`src/services/automation/handlers/combat/attackRiderHandler.js`): new
`registerRiderConditionExpiry` called from the failed-save branch of `handleRiderSave`. Registers
ONE clock per grant, mirroring the established duration-token anchors —
`until_start_of_next_turn` → FT-082/CLA-148 attacker-anchored
(`rounds: undefined, expireOnCreatureName: attacker`, fires at the holder's next turn-start once
the round has advanced); `until_end_of_next_turn` → CLA-169 Hills-Tumble `rounds: 2` target-axis
backstop. Each clock carries ONE merged write: `remove_target_effect` tuple-scoped to
this option's te row (effect+source+option+target) PLUS `{type:'condition'}` to strip the granted
condition at the same seam. Deliberately unclocked (verified pins): Trip's `prone`
(persistent-prone standard), Poison/Knock Out (`1_minute` repeatingSave — combat-scoped by the
duration policy; their repeat-save lane is the separate filed bug
`bug-devious-strikes-poison-repeat-save-never-fires.md`), and condition-less save legs (Shield
Bash). Success legs unchanged (evict lane). No 5e twin data path exists (census: save-gated
`attack_rider` options only in `public/data/2024/classes.json` Rogue ladder), so the shared
handler fix covers both rulesets.

Verification:
- New regression test `src/services/automation/handlers/combat/attackRiderHandler.daze-expiry.test.js`
  (6 tests): Daze fail-face clock shape + condition-strip tuple, Obscure `rounds:2` shape, Trip
  clockless pin, Poison clockless pin, success-no-clock pin. `npx vitest run` on the new file, the
  whole handlers/combat folder (66 files / 814 tests) and rules/effects (53 files / 455 tests): all
  pass. Adjacent class-fighter-rogue + hooks/combat: 272 files / 2419 pass, 3 pre-existing
  expected-fail. `npm run lint` zero warnings; `no-timers-guard` OK.
- Live repro BEFORE fix (test-campaign, sanctioned EF Rogue/AT-lv20 rig, warding_bond −19 dial):
  Daze-fail wrote the `daze|until_start_of_next_turn` te row + `["poisoned","dazed"]`,
  `pendingExpirations: []`, condition unchanged after EP's walked turn + round bump, and EF's
  Scimitar popup read `d20 18, 19 → 19 … | Adv (conditions)` — the filed behavior, byte-for-byte.
- Live re-verification AFTER fix: Daze-fail now stamps ONE ledger clock (GET-proved
  `pendingExpirations[0] = {target: ElderPaladin, effects:[remove_target_effect(daze tuple) +
  condition(dazed)], appliedRound:1, expiryRounds:null, expireOnCreatureName:EvasiveFighter}`);
  walking Initiative Next to EvasiveFighter's next turn-start evicted the te row (daze rows 0),
  stripped `dazed` leaving `["poisoned"]`, consumed the clock (`pendingExpirations: []`), and the
  follow-up Scimitar popup showed a single `d20 19 +9` roll with NO `Adv (conditions)` chip.
  Adjacent sanity live: new Trip fail-face still grants `prone` with `pendingExpirations: []`
  (persistent-prone intact); death_strike descriptor row untouched by the tuple-scoped eviction.
- Cleanup: EF disk restored byte-exact (md5 0df29ff3), sandbox map `daze-rig` deleted (maps back to
  the 4 owner fixtures), Admin-panel clears → change-data `{}` + log `[]`, GET-verified from a
  quiet (deselected) tab.
