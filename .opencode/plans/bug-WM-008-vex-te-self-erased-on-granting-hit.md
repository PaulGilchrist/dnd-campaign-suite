# BUG — WM-008 Vex weaponMastery: te self-erased during the same attack that applies it → Advantage never produced

**Verdict: FAIL** (2026-09-09, verified live in test-campaign, Playwright + change-data/log ground truth via `curl -H "Host: localhost"`).

## Expected (equipment.json Vex + manifest WM-008)
"If you hit a creature with this weapon and deal damage, you have Advantage on your next attack roll against that creature before the end of your next turn."
(Masteries are shared-equipment per-weapon properties — manifest class 'Barbarian' irrelevant; Vex weapons: Dart, Hand Crossbow, Handaxe, Net, Rapier 1d8 Piercing, Shortbow 1d6 Piercing, Shortsword 1d6 Piercing. Manifest expected-advantage consumer: next attack same target `forcedMode:'advantage'`.)

## Host / setup
EvasiveFighter lv18 Fighter Battle Master 2024. Kind bucket armed via "Weapon Mastery:" chooser → `_Weapon_Kind_Mastery_chosenWeapons = ['Shortsword']` (confirmed in change-data). EB Thug 1 (init 12) + Thug 2 (init 4), AC 11 Medium; turn walked to EvasiveFighter; target armed via card `[data-testid="target-select"]`.

## Evidence (own calls)
1. **Producer fires**: attack1 Shortsword HIT (d20 15+9=24 vs AC 11, 8 Piercing, hp_change 32→24) → log `ability_use "EvasiveFighter applied Vex to Thug 1"` + `EvasiveFighter/pendingExpirations[{target:'Thug 1', remove_target_effect next_attack_advantage source Vex, appliedRound 1, expiryRounds 2}]` + latch `_Vex_appliedTarget:'Thug 1'`. Same replayed vs Thug 2 (HIT 16, "applied Vex to Thug 2").
2. **te NEVER persists**: `targetEffects` is `[]` at every observation point — *while the hit popup is still open* (te[] in-mid-popup), after Done, and after Tactical-Master Skip. The `tacticalMaster` pipeline step (`attackRollPostDamage.js:436-488`) auto-applies Vex during the attack's own damage resolution (console `[WM-004 debug] tacticalMaster step ... autoApplyMasteries:[Vex]` at +22ms BEFORE `rollDamage`), then `attackPostProcessing.processAttackAfterResult` (invoked from `useLoggedDiceRollAttack.js:317` in the same resolution) hits its **Vex hit-clear** (`attackPostProcessing.js:191-198`) with `finalHit && vexTarget===targetName` and deletes the te that was stamped milliseconds earlier. The clear cannot distinguish "advantage granted by a PREVIOUS attack, now consumed by this hit" from "Vex just applied by THIS attack".
3. **Advantage never produced**: attack2 vs SAME target Thug 1 → popup single d20 (10), `lastAttack.forcedMode:"normal"` (expected `advantage`, playbook 42p: forcedMode is adv truth). Re-hit vs Thug 2 same: `forcedMode:"normal"`. Consumer `contextBuilder-sync.js:545-559` exists and unit-tests pass (`contextBuilder-sync.target-effects.test.js`) but is never fed a live te — grep+probe = consumer unreachable in practice.
4. **Latch compounds it**: `_Vex_appliedTarget` (`attackRollPostDamage.js:462-465`) blocks re-stamp vs the same target and has **zero reset consumers** (grep: no writer clears it except Admin clear) — even if a future hit "re-applies", same-target recovery is dead until admin clear.
5. **Kind-bucket gate leak (secondary)**: Shortbow hit logged "applied Vex to Thug 1" with chosenWeapons=['Shortsword'] only — `collectWeaponMastery` gate (`automationPassives.js:89-108`) did not null baseMastery for the Shortbow (Tactical Master modal also rendered "Tactical Master — Shortbow"), so mastery kind selection leaked to a non-chosen weapon (likely via Thrown Weapon Fighting style extraMastery passives — passives list included `push_or_prone`/extra mastery entries).
6. **Hit-gate OK (spec control)**: all 4 attacks happened to hit (d20 15/10/7/7 vs AC 11 +bonus); miss-branch static gate confirmed at `attackRollPostDamage.js:444` (`!lastAttack?.hit → return`) and Graze excluded (:453) — miss-first control only static, no live miss rolled.
7. **Expiry** moot: te already gone at grant; `pendingExpirations` shape correct (rounds=2 ≈ end-of-next-turn).

## Root cause
Same-resolution ordering: pipeline mastery write (step 'tacticalMaster', pre-Done) → damage apply → `processAttackAfterResult` hit-clear in ONE continuation. For hit-triggered, attacker-side, per-target te (Vex), the grant and its consumption-clear collide in the same attack. Studied Attacks survives 42q precisely because its write lives inside the miss branch of that same function (`attackPostProcessing.js:155-183`, runs before the clear block but guarded by `!finalHit`).

## Suggested fix
In the hit-clear block, skip te whose `appliedRound === currentRound && source === 'Vex'` stamped by the SAME attack (e.g., compare te timestamp/attack nonce against lastAttack), or move Vex autoApply to AFTER `processAttackAfterResult` in the resolution chain. Also add a round-based reset consumer for `_Vex_appliedTarget`.

## Damage/dice check (exact)
Shortsword 1d6+3 Piercing (rolls [5]→8, [6]→9), Shortbow 1d6+0 Piercing ([4]→4). Bonus +9 melee (STR? no — DEX build +3? computed), +6 ranged — per sheet rows. Weapon damage per weapon ✓.

## Cleanup
Admin clear change-data + log executed; equipped baseline unchanged (Scimitar, Shortbow, Shortsword); servers left running.
