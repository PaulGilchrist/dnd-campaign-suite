# MN-018 Sweeping Attack — E2E Verification (2026-10-09, test-campaign)

## Verdict: PASS-subset

## Canonical ground truth (`public/data/2024/maneuvers.json`)
- trigger `melee_weapon_attack_hit`, actionType `attack_rider`, effect `secondary_damage`, `damageBonus:false`, `dieExpression: superiority_die`
- Damage = **Superiority Die only** (NOT weapon+die), same type as original attack; original attack roll reused vs second creature's AC; 5 ft of original target + within reach.

## Consumer map (src/)
- Rider offer gate: `src/services/automation/handlers/class-fighter-rogue/combatSuperiorityQueries.js:49` (`melee_weapon_attack_hit` requires `attackInfo.hit === true`; unknown triggers default FALSE)
- Chooser: `executeAttackRider.js:102` `resolveSweepingAttack` → stash `pendingSweepingAttack` (CLA-326 raw-combatants shape) → modal `sweepingAttackTarget`
- UI: `SecondaryTargetModals.jsx` (`Apply Sweeping Attack`, radios), confirm → `combatSuperiorityUtils.js:364` `executeSweepingAttack` (one-shot consume, original roll vs B AC, `isWithinRange` 5 ft gate, `applyDamageToTarget`, log)

## E2E evidence (Playwright, localhost:5173, header verified `test-campaign`)
1. **Affordance**: melee HIT popup "HIT (13 vs AC 12)" → rider chooser modal lists **Menacing / Pushing / Sweeping Attack** (hit-only riders only).
2. **Miss sample**: original roll 13 vs Death Knight 1 AC 20 → log "Sweeping Attack: original attack roll 13 vs AC 20 misses Death Knight 1 — no damage." (original-roll reuse confirmed; no damage).
3. **Hit sample**: HIT (d20 9 +9 = 18 vs AC 12) → chooser "take 9 damage" → confirm → popup/log "Original attack roll 18 vs AC 12 hits Death Knight 1, which takes 9 Slashing damage (same type as the original attack)." **hp_change DK 999 → 990 exact (−9 = d12 die, Slashing)** — matches canonical die-only damage.
4. **Die ledger**: pool 6/6 d12 at start. First sweep rode **Relentless** (log "Rolled d8 for 3 (Relentless)", pool unchanged, `relentlessUsedRound=1`). Subsequent sweeps each logged "Rolled d12 for X. Expend 1 Superiority Die." with pool −1 per expend. Final cycle: re-armed 1 → consumed at Use Maneuver → confirm applied die 9; **pool 1 → 0 exact**. (Runtime re-arms via change-data POST: +2, +1, +1 — test-fixture only.)
5. **Exhaustion refusal** observed live: with pool 0, rider trigger → modal "Combat Superiority — No Superiority Dice remaining. Recharges on a Short or Long Rest."
6. **Selection persistence**: Manage/Confirm Selection POST persisted `BattleMasterManeuvers_selection` to runtime (5 incl Sweeping Attack, verified via change-data GET). Disk retains original 4-name selection (runtime is SSOT).

## Deviations / notes
- Secondary victim joined as **Death Knight 1** (search "Knight" matched Death Knight first). Its AC 20 blocked hits (6 sweep misses, all correctly rolled/logged); AC temporarily set 12 via combatSummary POST to obtain the hit sample. All test values wiped by final admin clear.
- MISS-on-A no-rider: trigger gate verified in code + unit tests (`combatSuperiorityQueries.mn014.test.js`); no live d20 ≤2 miss occurred during E2E (rolls 4,9,8,9,9,8,7 → never < AC 12 minus margin). Not directly observed → PASS-subset.
- Charger/Shield Master feats stripped for clean lane; no hijack modals appeared. Relentless d8-hijack observed once and accounted for in ledger.

## Cleanup proof
- Feats restored **byte-exact**: `shasum -a 256 public/campaigns/test-campaign/EvasiveFighter.json` = `8ff0fadb248574c895154ad1b782a9e243f2d87fcd8584c7ef228029becdf8cf` (== pre-session backup; includes Charger + Shield Master, original 4-maneuver selection).
- `POST /admin/clear-change-data` + `POST /admin/clear-log` → GET change-data `{}` (keys: []), log entries: 0. Joined Bandit 1 / Death Knight 1 removed with the clear; no active target/creature (deselect via clear).
