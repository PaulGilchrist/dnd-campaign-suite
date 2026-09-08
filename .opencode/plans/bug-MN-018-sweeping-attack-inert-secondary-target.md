# Bug MN-018 — Sweeping Attack: rider offered on misses, secondary-target chooser never renders, damage inert

**ID:** MN-018 | **Name:** Sweeping Attack | **Type:** maneuver (Fighter, attack_rider, trigger melee_weapon_attack_hit, uses superiority_die)

## Overview
The Combat Superiority rider UI offers Sweeping Attack on a melee weapon HIT and correctly spends exactly 1 Superiority Die (d12 at lv18 Battle Master) and logs an `ability_use` — but the secondary-target chooser modal it returns is swallowed by the prompt component, `pendingSweepingAttack` (the sole input of the only damage-applying function `executeSweepingAttack`) has ZERO writers, and no damage ever lands on any second creature. The app instead shows a misleading info popup claiming the second creature already took the damage. Additionally, the rider is offered on MISSes (trigger gate fail-open).

## Expected
Only on a melee weapon attack HIT: expend exactly 1 superiority die; offer a chooser for a creature within 5 ft of the original target and within reach; re-use the ORIGINAL attack roll vs the second creature's AC (hit-or-miss, no new roll); on hit, damage = superiority die roll, same type as original attack, actually applied (hp_change); accurate logs. No offer on miss or ranged hit.

## Actual (live E2E 2026-09-07/08, test-campaign, EvasiveFighter lv18 Battle Master 2024, EB Thug 1 + Thug 2)
1. **Offer gate — half works:** melee HIT opens "Combat Superiority — Use Maneuver" listing Sweeping Attack ✓; ranged Shortbow HIT → no prompt, no spend ✓.
2. **Offer gate — miss fail-open:** fresh MISS (Scimitar d20 2+7=9 vs AC 11, popup "✗ MISS") still opened the prompt listing "Sweeping Attack— on hit". Cause: miss branch feeds `getAttackRiderOptionsByContext` whose per-trigger filter falls through to `return true` for unmatched triggers (combatSuperiorityQueries.js:76; miss branch attackRollRiders.js:36-40).
3. **Die economy:** 1st use consumed NO die — rolled "d8 for 7 (Relentless)" (free lv18 passive, pool 1→1); 2nd use spent exactly 1 die d12 (pool 1→0, valid lv18 BM die). Short Rest writes `superiorityDice:null` → `??4` phantom refill (FS-010 repeats).
4. **Chooser never renders:** `executeAttackRiderManeuver` returns `type:'modal', modalName:'sweepingAttackTarget'` (executeAttackRider.js:207); useAttackDamageResolution.js:445 sets modal state, BUT `AttackRiderManeuverPrompt.handleUse` captures the same result in its applied-state and renders a generic info popup (`result.payload` is truthy for modal results, AttackRiderManeuverPrompt.jsx:37) with Done→onSkip. Live: popup text "Sweeping Attack: Rolled d12 for 12… A second creature within 5 feet of the target takes 12 damage" while NO chooser appeared and **Thug 2 HP stayed 32** (zero hp_change on second creature across all attacks).
5. **Execution path dead:** `handleSweepingAttackConfirm` → `executeSweepingAttack` (combatSuperiorityUtils.js:323) reads runtime `pendingSweepingAttack` — grep: no producer anywhere (`sweeping-attack-modal-show` event also has no production dispatcher, listener only). Even if reached: NO AC-vs-second-creature test, NO 5-ft/reach filter (secondaryTargets = all combatants minus primary/self), and `attackInfo` never carries `damageType` → hardcoded fallback `'slashing'` (executeAttackRider.js:212), so "same type as original attack" is unenforced. Modal desc reads `.primaryTarget` — a field the producer never sets (payload uses `targetName`).
6. **Logs:** `ability_use` rows exist ("Sweeping Attack: Rolled d12 for 12…") but describe damage that never occurred (popup-only automation / AGENTS.md logging gap). Trigger-hit collateral: nat-20 Scimitar crit damage stranded when the rider popup overwrote the hit popup before Done (FT-074/CLA-326 family); stale "Shield Bash DC15" save prompt re-queued every rider (known FT-074 leftover).

## Steps
1. EvasiveFighter lv18 Fighter 2024 → Edit wizard subclass Battle Master; Combat Superiority chooser → tick Sweeping Attack → Confirm (persists `BattleMasterManeuvers_selection`).
2. EB: join Thug ×2 (gridless). Walk initiative to EvasiveFighter; card target-select → Thug 1.
3. Melee HIT → prompt lists Sweeping Attack → select + "Use Maneuver" → die spent (or Relentless d8 free) → expect a "Choose a creature within 5 feet…" chooser; actual = info popup claiming damage; Thug 2 unharmed. Confirm via `/api/campaigns/test-campaign/change-data` (`pendingSweepingAttack` ABSENT) + log.
4. Miss a melee attack → prompt still offers Sweeping Attack (fail-open).
5. Ranged HIT → no prompt (control passes).

## Likely Location
- `src/components/char-sheet/modals/AttackRiderManeuverPrompt.jsx` (~line 37 applied-state must special-case `result.type==='modal'`/`modalName==='sweepingAttackTarget'` and let SecondaryTargetModals render instead of the generic popup)
- `src/components/char-sheet/useAttackDamageResolution.js:445` (modal-state handoff; must also stash pending payload into `pendingSweepingAttack` that `executeSweepingAttack` reads)
- `src/services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js:323 executeSweepingAttack` (add original-attack-roll vs second-creature AC test, 5-ft/reach gate, real damageType from the trigger attack)
- `src/services/automation/handlers/class-fighter-rogue/combatSuperiorityQueries.js:76` (default `return true` makes miss branch offer hit-triggered riders)
- `src/services/combat/steps/attackRollRiders.js:36-40` (miss branch)

## Notes
- Die type d12 at lv18 is table-correct (automationExpressions.js lv18→12); count judge separately from FS-010 style-d6 issue (not applicable for true Battle Master host).
- Relentless free-d8 first use is app-model behavior but bypasses "expend exactly 1 die" — record divergence.
- SecondaryTargetModals description field mismatch `.primaryTarget` vs producer `targetName` (cosmetic-confirm crash risk).
- Gridless leniency per playbook §7 noted; 5-ft gate unenforceable without map, but ZERO gate code exists regardless.
