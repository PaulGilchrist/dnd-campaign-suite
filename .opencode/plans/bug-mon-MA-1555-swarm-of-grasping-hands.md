# MA-1555 — Swarm of Crawling Claws "Swarm of Grasping Hands" — FAIL(a)/DATA

## Verdict
**FAIL(a)/DATA** — base attack (+4, 4d8+2 necrotic, reach 5 ft.) is LIVE and exact (PASS-partial), but both secondary clauses are prose-only and inert live: the Bloodied 2d8+2 variant never offers/rolls (no `conditional_damage`; `buildChargeBonusOffer` guard `cd?.dice` returns null — swarm-row twin of MA-1552/MA-1553/MA-1554 codified today), and the Medium-or-smaller → Prone hit rider never applies (no `hit_conditions`; `applyHitClauseConditions` never fires — MA-1541 lane). Expected FAIL(a) confirmed.

## ROW (manifest)
```json
{"id":"MA-1555","monster":"Swarm of Crawling Claws","monsterIndex":"swarm-of-crawling-claws","actionName":"Swarm of Grasping Hands","actionType":"attack","attackBonus":4,"damageDicePrimary":"4d8 + 2","damageTypePrimary":"Necrotic","reach":"5 ft.","conditions":["prone"],"description":"Melee Attack Roll: +4, reach 5 ft. Hit: 20 (4d8 + 2) Necrotic damage, or 11 (2d8 + 2) Necrotic damage if the swarm is Bloodied. If the target is a Medium or smaller creature, it has the Prone condition."}
```

PRIMARY: `public/data/monsters.json` → swarm-of-crawling-claws → actions[0] carries only `attack_bonus: 4`, `reach: "5 ft."`, `damage_dice_primary: "4d8 + 2"`, `damage_type_primary: "Necrotic"` — **no `conditional_damage`, no `hit_conditions`**.

## Setup
EB exact "Swarm of Crawling Claws" + "Bandit" → Join Encounter → initiative (round 1): swarm cs 49/49 init 18, Bandit cs 11/11 AC 12. First card click absorbed (§138), second opened card; Target select = Bandit 1. Card chip renders ROW text verbatim.

## Component 1 — Base attack +4 / 4d8+2 necrotic — PASS (live, exact)
- ✓ HIT d20 9 +4 = 13 vs AC 12 → damage popup/log `formula:"4d8 + 2"`, rolls [4,3,6,6], total 21, type Necrotic → hp_change `delta:-21` (Bandit 11 → 0). Exact base formula, exact type, exact +4 bonus.
- Miss ladder (d20 + 4 < 12 ⇒ ≤7, all clean misses, zero damage): d20 6 (disadvantage pair 10,6) → MISS (10 vs AC 12); d20 3 → MISS (7); d20 1 → "Critical Miss!" MISS (5).
- Attack log entries: `rolls:[10,6] total:10 bonus:4`, `rolls:[3,5] total:3`, `rolls:[1,4] total:1`, `rolls:[9,6] total:9` — all `(+4 to hit)`.
- Server `lastAttack` (hit): `{d20:9, bonus:4, total:13, hit:true, damageFormula:"4d8 + 2", damageType:"Necrotic", weaponType:"melee"}`.

## Component 2 — Bloodied 2d8+2 variant — FAIL (inert; twin of MA-1552/1553/1554)
No `conditional_damage` on the action ⇒ `MonsterCardHelpers.js` `buildChargeBonusOffer` guard on `cd?.dice` ⇒ offer never arms regardless of swarm HP.

- Healthy swarm (49/49): to-hit popups contained only Advantage/Disadvantage toggles + Done/miss banner — **zero Bloodied/2d8+2 offer chrome**.
- Bloodied probe — swarm spinner dropped to cs 20/49 (20 ≤ 24.5 ⇒ Bloodied active): +4 pressed → ✓ HIT (15 vs AC 12) → damage popup **"4d8 + 2: 2, 6, 6, 4 +2 = 20 damage applied to Bandit 1"** — **zero-delta vs healthy state**: same base 4d8+2, no 2d8+2 reduced path, no offer popup. Campaign-log damage entry: `formula:"4d8 + 2", rolls:[2,6,6,4], total:20, damageType:"Necrotic"`; hp_change `delta:-20`.

## Component 3 — Hit rider: Medium-or-smaller → Prone — FAIL (inert)
No `hit_conditions` on the action ⇒ `handlePlainDamage.js` `applyHitClauseConditions` (requires `action.hit_conditions`, MA-1541 lane) never runs — confirmed MA-1541 lineage.

- Bandit 1 (size "Medium or Small") was hit by Swarm of Grasping Hands twice (21 dmg, 20 dmg). Post-hit `combatSummary` Bandit creature: **no `activeConditions` / conditions key anywhere**.
- Full `change-data` scan after hits: only two "prone" occurrences in the entire payload — `/combat-ui-viewingMonster/actions[0]/description` (static ROW prose) and `/combat-ui-viewingMonster/immunities[10]` (the swarm's own static Prone immunity). **Zero condition applications to Bandit** — rider never fires; target only ever went plain `isUnconscious:true` at 0 HP.

## Root cause
DATA: action lacks both structured fields:
1. No `conditional_damage` ⇒ Bloodied 2d8+2 variant unrollable/unoffered (identical shape to codified swarm twins MA-1552/MA-1553/MA-1554).
2. No `hit_conditions` ⇒ prone rider inert; Bandit is Medium-or-smaller on every hit yet never gains Prone.

## Proposed fix
Add to `public/data/monsters.json` → swarm-of-crawling-claws → actions[0] "Swarm of Grasping Hands" (house shape, per MA-1552/1553/1554 fixes):
```json
"conditional_damage": { "dice": "2d8 + 2", "damage_type": "Necrotic", "condition": "Bloodied" },
"hit_conditions": ["prone"]
```
Note on the prone rider gate: clause applies only when the target is a **Medium or smaller creature** (swarms/Larger targets are excluded; the swarm itself is Prone-immune anyway). If `hit_conditions` auto-grant (`handlePlainDamage.js`/`MonsterCardHelpers.js`) has no size gate, gate at grant time (`target.size` in Tiny/Small/Medium) before applying Prone; Bandit ("Medium or Small") must gain Prone on hit.

## Cleanup (done)
Initiative Clear ✓ (confirm accepted; tracker party-only, no NPC placeholders server-side). Admin → Clear Change Data ✓ (`change-data` keys `[]`, `combatSummary.creatures []`). Admin → Clear Campaign Log ✓ (log entries 0). Only test-campaign touched; campaign header verified `test-campaign` throughout.
