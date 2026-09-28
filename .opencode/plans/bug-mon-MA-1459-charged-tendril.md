# BUG MA-1459 — Shambling Mound Charged Tendril — FAIL(a) (pull clause zero-state)

**Row:** MA-1459 `shambling-mound|actions|1` — Charged Tendril, attack+attack, +7 vs, reach 10 ft., 1d6+4 Bludgeoning + 2d4 Lightning (rider), size-conditional pull.
**Session:** 2026-09-27, test-campaign, dev :5173, rig reused from MA-1458 (Shambling Mound 1 110/110 + Bandit 1 AC12 clean victim). Header verified `test-campaign`; target armed on mound's OWN-card select (Bandit 1).

## VERDICT: FAIL(a) — hit-clause zero observable state
Core numerics are EXACT across 12 presses (9 hits, 3 misses, 1 crit), but the explicit hit clause
*"If the target is a Medium or smaller creature, the shambling mound pulls the target 5 feet straight
toward itself"* produces **zero state** on every one of 9 landed hits on a Medium victim:
no te, no log, no advisory, no token movement. Same clause-gap class as MA-1451 (STR-drain zero-state)
and §101 (attack-row push inert-by-construction). Per strict trichotomy standard: zero observable
state for an explicit hit clause = FAIL(a).

## Fire table (log-verified, log idx 8→37)
| # | d20 | total (+7) | vs AC12 | Bludgeoning (1d6+4) | Lightning rider (2d4) | hpΔ | check |
|---|-----|-----------|---------|--------------------|----------------------|-----|-------|
| 1 | 14 | 21 | HIT | [6]=10 | [2,2]=4 | −14 | 10+4 ✓ |
| 2 | 5 | 12 | HIT (tie→attacker, boundary) | [4]=8 | [2,2]=4 | −12 | ✓ |
| 3 | 7 | 14 | HIT | [1]=5 | [2,4]=6 | −11 | ✓ |
| 4 | 16 | 23 | HIT | [6]=10 | [2,1]=3 | −13 | ✓ |
| 5 | 4 | 11 | MISS (boundary) | — | — | 0 | ✓ |
| 6 | 15 | 22 | HIT | [3]=7 | [4,2]=6 | −13 | ✓ |
| 7 | 7 | 14 | HIT | [6]=10 | [2,4]=6 | −16 | ✓ |
| 8 | 1 | 8 | MISS | — | — | 0 | ✓ |
| 9 | 1 | 8 | MISS | — | — | 0 | ✓ |
| 10 | 11 | 18 | HIT | [5]=9 | [4,4]=8 | −17 | ✓ |
| 11 | 17 | 24 | HIT | [2]=6 | [2,4]=6 | −12 | ✓ |
| 12 | **20** | 27 | **CRIT** | formula `1d6*2+4 (1)` =6 (flat +4 NOT doubled §32) | secTotal 6 = 2×(2+1) both pools doubled (§831 lineage) | −12 | 6+6 ✓ |

- Rider "plus 5 (2d4) Lightning" is unconditional in prose → correctly rides **every** hit (9/9).
- All legs in authored bands: Bludgeoning 5–10, Lightning 2–8.
- Misses pay zero (no damage roll, no hp_change entries).
- hpΔ == sum of legs on every hit; final cs HP path 999→879 reconciled exactly.
- nat1 prints cosmetic "CRITICAL MISS!" banner (§695) but adjudicates honest hit:false at 8<12.

## Pull-clause evidence (FAIL(a) basis)
- **Live, 9 hits on Medium Bandit:** Bandit 1 `targetEffects: null`, `activeConditions: None`, `activeConditionMeta: {}`; full log 38 entries: `pull` mentions **0**, `move` mentions **0**, types only roll/hp_change/encounter; no token movement (map gridless, `__map__` holds only `activeMapName` — §42 token-delta N/A, same as §202/§1401 movement-clause rows).
- **Static grep:** `parsePullClause|pullClause|pull_clause` — ZERO app-wide. te `pulled_toward` (targetEffectDefinitions.js:1319) has exactly one producer: `pullMarkerEffect="pulled_toward"` passed ONLY by WarpingImplosionModal.jsx:52 (PC sorcerer spell); SaveAttackAoeModal registers it only on failed saves of rows threading that prop (CLA-384). Monster attack chips never pass it. `parsePushFeetClause` (MonsterCardHelpers.js:128) reads `save_effect` only, consumed at MonsterCardModal.jsx:285 for save-picker rows (§101 lineage untouched by attack path). No `moveToken|setTokenPos|updateToken` consumer (monsterRedirectAttack.js:30 comment re-confirms grep-zero).
- No parser, no forward prop, no grant, no consumer, no advisory chip on this lane → clause is inert-by-construction with zero state = FAIL(a), consistent with MA-1451 zero-state standard. (Contrast §1401 Reel PASS-subset precedent was RAW-advisory with unreachable grapple precondition; here precondition IS satisfied and clause is unconditional transport, so the stricter MA-1451 standard applies per ticket directive.)

## Suggested fix direction (fix conventions §5)
Attack-hit transport marker template: parse clause in MonsterCardHelpers (arm on description/structured field),
grant instant te (register e.g. `pulled_5ft` in targetEffectDefinitions) on hit in handlePlainDamage path +
one grant log; grid token move stays grep-zero advisory (§42) — but the te+log gives the observable state
RAW clause requires. Engulf (MA-1460) save-row pull rides a different (save-picker) lane.

## End-state (cleanup for MA-1460)
Initiative INTACT round 1, 16 creatures: Shambling Mound 1 110/110 (target Bandit 1 armed), Bandit 1 topped
999/999 via card fill+Enter (no API mutation POSTs). Card closed; log left in place (38 entries).
