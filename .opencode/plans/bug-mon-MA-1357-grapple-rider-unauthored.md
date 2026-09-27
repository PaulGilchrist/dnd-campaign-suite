# MA-1357 — Purple Worm Bite: Grappled+Restrained on-hit rider inert — FAIL(b)/DATA

**Row:** purple-worm actions[1] "Bite" (+14, reach 10 ft., 3d8 + 9 Piercing)
**Verdict:** FAIL(b)/DATA (§MA-1344 shape — ungated-by-movement discrete-condition rider, unauthored; §MA-1347 framing precedent: movement-gated riders are advisory, ungated riders unauthored = FAIL(b)/DATA)

## Expected (RAW, description byte-carry)
On hit against a Large-or-smaller creature: Grappled (escape DC 19) + Restrained until the grapple ends.

## Disk (public/data/monsters.json actions[1], verbatim)
```json
{
  "name": "Bite",
  "description": "Melee Attack Roll: +14, reach 10 ft. Hit: 22 (3d8 + 9) Piercing damage. If the target is a Large or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 19), and it has the <strong>Restrained</strong> condition until the grapple ends.",
  "attack_bonus": 14,
  "save_dc": 0,
  "save_type": "",
  "save_effect": "",
  "range": "",
  "reach": "10 ft.",
  "recharge": "",
  "damage_dice_primary": "3d8 + 9",
  "damage_type_primary": "Piercing"
}
```
Rider structured fields: `hit_conditions` **ABSENT**, `escape_dc` **ABSENT**, `hit_target_effect` **ABSENT**, `save_margin` **ABSENT** (all three purple-worm action rows grep-zero for all four keys; fresh-served check via `fetch(cache:'reload')` post-reload also riderKeys []).

## Consumer chain (live, unarmed)
- `buildHitConditionClause` — src/components/encounter/MonsterCardHelpers.js:673-686 — reads ONLY `action.hit_conditions` / `action.hit_target_effect` / `parseHitConditionRoll(action)` (+`escape_dc` stamp). All absent → returns `null` (:679 early return).
- `maybeApplyHitClause` — src/hooks/combat/handlers/handlePlainDamage.js:611 — `if (!hitClause || !target || !applyResult) return;` (:613) — never reached on any hit.
- `applyHitClauseConditions` — handlePlainDamage.js:543 — would grant ANY listed conditions incl. grappled AND restrained (aberrant-cultist Tentacle Lash `["grappled","restrained"]+escape_dc:14` live twin) + meta {dc, ability:'str', source} + `condition applied` log with "(escape DC N)".
- `applyHitClauseTargetEffect` — handlePlainDamage.js:654 (not applicable — no hit_target_effect).

## Live evidence (test-campaign, localhost:5173, 2026-09-26)
Rig: admin-clear → reload → re-select → EB join Purple Worm 1 (idx purple-worm, cs idx 1) + Bandit 1 (AC12→rig 19, Medium-or-Small passes `isLargeOrSmallerTarget`); victim all-4-HP-keys 999 via full-store cs POST; own-card target-select armed Bandit 1.

8 chip rolls (strong.startsWith('Bite') anchor; card showed ZERO save chip — save_dc:0 decoy §117):

| # | d20 | +14 vs AC | result | damage formula | fd | hpΔ |
|---|-----|-----------|--------|----------------|----|-----|
| 1 | 16 | 30 vs 12 | hit | 3d8 + 9 [2,6,2] | 19 | 999→980 |
| 2 | 8 | 22 vs 12 | hit | 3d8 + 9 [4,1,8] | 22 | →958 |
| 3 | 18 | 32 vs 12 | hit | 3d8 + 9 [8,5,4] | 26 | →932 |
| 4 | 12 | 26 vs 12 | hit | 3d8 + 9 [7,2,2] | 20 | →912 |
| 5 | 19 | 33 vs 19 | hit | 3d8 + 9 [6,5,8] | 28 | →884 |
| 6 | **20** | 34 vs 19 | **crit** | **3d8*2+9 (6,1,8)** | 39 | →845 |
| 7 | 1 | 15 vs 19 | **miss** | — (zero entry) | — | none |
| 8 | 6 | 20 vs 19 | hit | 3d8 + 9 [2,6,3] | 20 | →825 |

Σfd = 174 == Σ|hpΔ| = 999−825 exact. Crit doubles DICE only (flat +9 undoubled §32). Miss zero-damage.

**RIDER AXIS: inert 7/7 hits.** Bandit 1 change-data `activeConditions` null, `activeConditionMeta` null, top-level `targetEffects` null, whole-log condition-grant entries = 0, `pendingSavePrompts` null; `lastAttack.saveDc/saveType` null (decoy honest §117). No "Grappled"/"Restrained"/escape-DC-19 ever surfaces on any surface.

## Fix (zero code, two-field DATA)
`hit_conditions: ["grappled", "restrained"]` + `escape_dc: 19` (byte-shape twins: aberrant-cultist Tentacle Lash escape_dc:14, crocodile, chain-devil, giant-octopus, mezzoloth, lizardfolk-shaman). Consumer grants both conditions + meta{dc:19,ability:'str',source} + escape badge save. Size-gate advisory: `isLargeOrSmallerTarget` (handlePlainDamage.js:518) admits up to Large — gridless advisory per §1274 precedent (Bandit "Medium or Small" rides cleanly).

## Cleanup
Admin-clear change-data + log after session; registry Purple Worm updated with MA-1357 FAIL(b)/DATA row.
