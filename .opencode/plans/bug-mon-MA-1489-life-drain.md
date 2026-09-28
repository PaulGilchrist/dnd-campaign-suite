# BUG — MA-1489 Specter Life Drain: HP-maximum-reduce rider ZERO-STATE

**Verdict: FAIL(a)** — attack core numerics exact, but the explicit HIT clause
"If the target is a creature, its Hit Point maximum decreases by an amount equal
to the damage taken" produces ZERO observable state on every surface.
MA-0838/MA-1451 fingerprint: explicit hit clause, no structured transport,
no producer, no consumer reachable, no advisory = FAIL(a), never PASS-subset.

## Row (verbatim)
```json
{"id":"MA-1489","stableKey":"specter|actions|0","monsterIndex":"specter","monster":"Specter","actionIndex":0,"actionType":"attack","attackBonus":4,"damageDicePrimary":"2d6","damageTypePrimary":"Necrotic","reach":"5 ft.","description":"Melee Attack Roll: +4, reach 5 ft. Hit: 7 (2d6) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.","verified":"not verified"}
```

## STATIC (disk public/data/monsters.json — verified via own python3 read)
- actions[0] keys ONLY: attack_bonus=4, damage_dice_primary="2d6", damage_type_primary="Necrotic", reach="5 ft.", name="Life Drain", description.
- ABSENT: `hit_target_effect`, `hit_conditions`, `hp_max_reduce`, `automation`, save fields. No structured rider authored.

## GREP (app-wide, own rg)
- `hpMaxReduction` CONSUMERS ONLY: `src/services/automation/handlers/spells/greaterRestorationHandler.js:95-104` (reads, restores base HP, writes **0**); `CharActionSpellPopups.jsx:239`, `TargetSpellPopups.jsx:52` (display-only). **NO producer sets it >0 anywhere.**
- `hit_target_effect` producer seam `applyHitClauseTargetEffect` (`handlePlainDamage.js:643/658`, MonsterCardHelpers `:696` reads `action.hit_target_effect`) — row has none → inert path (§116 producer-only rule).
- `targetEffectDefinitions.js`: NO hp-max-reduce te registered (grep `hp_max|hpMax` → only :574 "HP maximum can't be reduced" prose on unrelated aura/no_healing entry).
- No parser anywhere for "Hit Point maximum decreases" prose.

## LIVE (test-campaign, :5173 reuse; EB join Specter 1 idx0 init16 + Bandit 1 idx1 AC12 resistances[] clean)
- Victim Bandit 1 HP 999 via card input TRUSTED fill (no API mutation POSTs). cs BEFORE: maxHp **11**, currentHp 999.
- Gridless (activeMapName null) → lenient range §42, rangeReason:null.
- Armed via Specter 1 OWN initiative-card `[data-testid=target-select]` selectOption → "Bandit 1". Active creature truth = top-level activeCreatureName (cs mirror lag §113).
- 5 chip fires (ONE mc-dice-link chip §116), misses need popup-close-btn, hits ride stage-2 reroll-btn→close.

### Hit table (log-machine truth; cs maxHp read before + after each hit)
| # | to-hit (d20+4 vs AC12) | damage rolls (formula byte) | fd | hpΔ | maxHp BEFORE | maxHp AFTER |
|---|------------------------|-----------------------------|----|-----|--------------|-------------|
| 1 | nat6+4=10 ✗ MISS | — | 0 | 0 | 11 | 11 |
| 2 | nat13+4=17 ✓ HIT | 2d6 [3,4] | 7 | −7 (999→992) | 11 | **11** |
| 3 | nat17+4=21 ✓ HIT | 2d6 [4,3] | 7 | −7 (992→985) | 11 | **11** |
| 4 | nat8+4=12 ✓ HIT (tie-to-attacker boundary) | 2d6 [5,5] | 10 | −10 (985→975) | 11 | **11** |
| 5 | nat8+4=12 ✓ HIT | 2d6 [4,5] | 9 | −9 (975→966) | 11 | **11** |

- All 4 hp_change log entries stamp `maxHp: 11` unchanged — carrier field exists live, value never moves.
- hpΔ == fd on 4/4 ✓; formula "2d6" byte-exact on 4/4, NO flat mod ✓; damageType Necrotic ✓; unclamped currentHp staged despite maxHp 11 (§120/§181 precedent).
- Crit axis vacuous — no nat20 rolled; dice-transport machinery for doubling already proven elsewhere (§32). Distinct first-dies 6/13/17/8/8, damage rolls distinct → no replay-cache contamination.
- Rider surfaces all silent: runtime `Bandit 1` dict = `pendingExpirations` only (no hpMaxReduction/max keys); zero log entries mentioning max beyond cs mirror echoes; no badge, no advisory, no popup line.

## FAILURE SURFACE ANALYSIS
- Explicit hit clause (not save-gated) → needs attack-hit producer: `hit_target_effect` + registered te + turn-time consumer, or a new structured `hp_max_reduce` with a consumer that mutates cs.maxHp / stamps hpMaxReduction. Both missing.
- Advisory surface does NOT exist (no log prose, no badge) → PASS-subset barred; zero-state FAIL(a) per §1 verdict policy.

## FIX SKETCH (data + code, out of this row's scope)
1. DATA: `hit_target_effect:"hp_max_reduce"` (or `hp_max_reduce:true`) on row.
2. CODE: register te in `targetEffectDefinitions.js`; consumer in hit path (applyHitClauseTargetEffect / damage post-processing) decrementing cs `maxHp` (clamp currentHp) or stamping `hpMaxReduction` (consumer greaterRestoration already exists to undo).

## OPERATIONS
- Console 0 errors. No off-localhost navigation (§90 injection echo re-confirmed: Admin click echoed fabricated aliyuncs proxy OSS URL inside tool result — rejected, own `location.href` = localhost:5173 verified).
- Cleanup: admin Clear Change Data + Clear Campaign Log (native confirms auto-accepted, banners confirmed test-campaign). Quiet state verified twice: log [] + cd {} (§14/§15).
- Campaign lockdown held: test-campaign only; no manifest/git writes; HP via card input only.
