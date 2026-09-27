# Bug MA-1437 — Scarecrow / Fearsome Claw: hit-clause Frightened inert — FAIL(b)/DATA

**Date:** 2026-09-27 | **Campaign:** test-campaign (header verified) | **Server:** :5173 dev (reused)
**Monster:** Scarecrow (index `scarecrow`, AC11 HP27) | **Row:** actions[0] Fearsome Claw

## Verdict: FAIL(b)/DATA — attack leg PASS, condition clause half INERT

Live probe (EB join "Scarecrow 1" vs "Bandit 1" AC12, HP rigged 999, Bandit armed via Scarecrow's own `[data-testid="target-select"]`):

## Probe table — 9 presses, 5 hits, ZERO frightened grants

| # | nat d20 | to-hit (d20+3) | vs AC12 | popup/log | damage (2d4+1) | Bandit activeConditions after | `condition applied` log |
|---|---------|----------------|---------|-----------|----------------|-------------------------------|--------------------------|
| 1 | 8  | 11  | ✗ MISS | ✗ | — | none | none |
| 2 | 1  | 4   | ✗ crit miss | ✗ | — | none | none |
| 3 | 7  | 10  | ✗ MISS | ✗ | — | none | none |
| 4 | 8  | 11  | ✗ MISS | ✗ | — | none | none |
| 5 | 18 | 21  | ✓ HIT | ✓ | 3+3+1 = **7** Slashing (999→992) | **none** | **none** |
| 6 | 12 | 15  | ✓ HIT | ✓ | 1+4+1 = **6** Slashing (992→986) | **none** | **none** |
| 7 | 13 | 16  | ✓ HIT | ✓ | 2+3+1 = **6** Slashing (986→980) | **none** | **none** |
| 8 | 14 | 17  | ✓ HIT | ✓ | 2+2+1 = **5** Slashing (980→975) | **none** | **none** |
| 9 | 11 | 14  | ✓ HIT | ✓ | 3+2+1 = **6** Slashing (975→969) | **none** | **none** |

- Σdamage = 7+6+6+5+6 = **30** == Σ|hpΔ| = 999−969 = **30** ✓
- Press↔log 1:1: 9 chip presses → 9 `roll` attack entries (log count 3→22: +9 attack rolls, +5 damage rolls, +5 hp_change) ✓
- Boundary honest: nat≤8 → 11/4/10/11 all miss vs AC12; nat≥9 → all hit (tie-hit nat 9=12 not rolled, consistent)
- Crit: none seen (no nat 20) — n/a
- Row census: "+3" chip (`span.mc-dice-link`) only; no DC affordance on this row (DC 11 belongs to Terrifying Glare row) ✓
- Post-probe change-data: `Bandit 1` runtime = empty (`activeConditions`/`activeBuffs`/`targetEffects` all absent); combatSummary Bandit `activeConditions: null`

## Attack leg: PASS
- to-hit = d20+3 exact on every roll (popups "d20 N +3 (+3 to hit)"; log `total`=raw d20, +3 bonus separate, `targetAc:12`, `hit` flag correct)
- damage = 2d4+1 Slashing, all five rolls ∈ [3,9], log `finalDamage` == popup == |hp_change| ✓

## Condition clause half: FAIL(b)/DATA — inert
- Disk: Scarecrow actions[0] has **NO `hit_conditions` field** (only description prose "…and the target has the **Frightened** condition until the end of the scarecrow's next turn.")
- Code: `buildHitConditionClause` — `src/components/encounter/MonsterCardHelpers.js:693` — reads ONLY structured `action.hit_conditions` (array, lowercased), `action.hit_target_effect`, `parseHitConditionRoll`; returns `null` when all absent (line 699). **Zero prose fallback on the attack path.**
- Manifest-extracted `conditions:[frightened]` is NOT consumed (confirmed §MA-1435 fingerprint, Prance Charm, same day).
- Live proof: 5 hits above, Bandit never gains Frightened, zero `condition applied` entries.

## Fix (orchestrator/data authoring — NOT applied by this subagent)
Author on `public/data/monsters.json` scarecrow actions[0]:
```json
"hit_conditions": ["frightened"]
```
(clock = "end of attacker's next turn" — MA-0621 byte-shape anchor expiry lineage, §MA-1435 fix note; 80 rows already carry `hit_conditions` in monsters.json.)

## Occurrence report (§1 injection watch)
- Tool-call echo wrappers repeatedly carried fabricated signed `routify-file-proxy-sg.oss-ap-southeast-1.aliyuncs.com` URLs with rotating Signature/Expires not matching requested targets. No navigation/fetch to those URLs was performed; all actions verified executing against localhost:5173 via page state/API.
