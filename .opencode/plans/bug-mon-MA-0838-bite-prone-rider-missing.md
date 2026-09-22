# BUG MA-0838 — Gibbering Mouther Bite: Prone-on-hit rider never granted (FAIL(a)/DATA one-field)

**Row:** gibbering-mouther|actions|0 "Bite" — +2, reach 5 ft., 2d6 Piercing, "If the target is a Medium or smaller creature, it has the Prone condition."
**Verdict:** FAIL(a)/DATA one-field fix. Numeric axis LIVE+EXACT; Prone grant axis ZERO. Byte-twin MA-0791 Talons / MA-0802 Tail (identical "Medium or smaller → Prone" prose, hit_conditions absent).

## Disk static (monsters.json actions[0], byte-verified)
```json
{"name":"Bite","description":"Melee Attack Roll: +2, reach 5 ft. Hit: 7 (2d6) Piercing damage. If the target is a Medium or smaller creature, it has the <strong>Prone</strong> condition. The target dies if it is reduced to 0 Hit Points by this attack. Its body is then absorbed into the mouther, leaving only equipment behind.","attack_bonus":2,"reach":"5 ft.","save_effect":"If the target is a Medium or smaller creature, it has the Prone condition. ...","damage_dice_primary":"2d6","damage_type_primary":"Piercing"}
```
- avg "7 (2d6)" ✓ byte; attack_bonus 2 ✓; reach "5 ft." ✓.
- `hit_conditions` **ABSENT**. `save_effect` present but = DECOY on a no-save_dc attack row (§115/§156 MA-0522/MA-0527); machine-proof live: `lastAttack.saveDc:null` + `saveType:null` on every chip hit (§203 fingerprint).

## Live ledger (test-campaign, Bandit 1 AC12 "Medium or Small" cs idx1 maxHp999, Mouther cs idx0)
- 5 fires, "+2" chip (§116 single-chip), target armed own initiative card:
  - HIT nat11+2=13✓AC12 — "2d6" Piercing rolls[1,1] fd2 |Δ|2
  - HIT nat10+2=12✓AC12 tie-to-attacker honest boundary — rolls[3,3] fd6 |Δ|6
  - MISS nat8+2=10✗AC12 — Done-less popup 0 buttons, zero damage entry, zero hpΔ, zero cond (§94/§33)
  - MISS nat7+2=9✗ — same clean miss shape
  - HIT nat12+2=14✓ — rolls[2,5] fd7 |Δ|7
- hp chain 999→997→991→984, Σ−15 == 2+6+7 exact unclamped (§181); distinct first-dies 11/10/8/7/12 kill §77 replay; mode:normal dupe second die judged first-die (§92).
- Crit: no nat20 in 5 — "2d6*2" axis conditionally vacuous (family proven MA-0802/MA-0812).
- **PRONE axis FAIL:** 3/3 hits → whole-log "prone" count **0**, `condition applied` entries **0**, Bandit change-data `activeConditions`/`activeConditionMeta` **ABSENT**, top-level `targetEffects` **ABSENT**. Consumer chain: buildHitConditionClause MonsterCardHelpers.js:562 reads `action.hit_conditions` only → null clause → applyHitClauseConditions handlePlainDamage.js:513 never fires; isLargeOrSmallerTarget gate (:488/:503) live but starved; victim Medium-or-Small size-honest.
- Console 0 errors.

## Instant-death / body-absorb clause = §70 ADVISORY (not FAIL driver)
- `rg "dies if" src/ server/` = **grep-zero** — no zero-HP-instant-death consumer app-wide on attack rows. All "absorb" hits in src = TempHP/Arcane Ward/elemental-absorption (unrelated mechanics). `zero_hp_clause` consumer exists ONLY via eye-rays picker (§100/§88, MA-0374).
- Possession/stat-fold advisory precedent: MA-0782 Ghost Possession PASS-subset, §70 sustained-state zero-consumer residuals.
- Bandit held alive at maxHp999 (max observed fd 7) — clause untestable and un-built; honest advisory note.

## Fix (DATA, one field, no code)
Author `hit_conditions:["prone"]` on gibbering-mouther actions[0] — MA-0621/MA-0791/MA-0802 byte-shape; consumer live (handlePlainDamage incl. Large-or-smaller gate), Medium-gate already honest.

## Cleanup
Admin clear verified log:[] cd:{} quiet; tab closed; no manifest/git writes (orchestrator owns verified).
2026-09-22
