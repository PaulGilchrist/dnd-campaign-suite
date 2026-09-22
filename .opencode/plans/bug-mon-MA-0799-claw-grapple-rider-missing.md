# BUG MA-0799 — Giant Crab Claw: Grappled rider never granted (FAIL(a)/DATA, two-field)

## Row
`giant-crab|actions|0` Claw — "+3, reach 5 ft. Hit: 4 (1d6 + 1) Bludgeoning. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 11) from one of two claws."

## Disk (public/data/monsters.json giant-crab actions[0], FULL)
```json
{"name":"Claw","description":"Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Bludgeoning damage. If the target is a Medium or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 11) from one of two claws.","attack_bonus":3,"reach":"5 ft.","damage_dice_primary":"1d6 + 1","damage_type_primary":"Bludgeoning"}
```
- `hit_conditions`: ABSENT. `escape_dc`: ABSENT. avg 4 (1d6+1≈3.5+1) ✓.
- Attack-hit prose grapple lands ONLY via authored `hit_conditions:[...]+escape_dc` (MA-0010 seam, playbook §59/§150/§212); plain `conditions:["grappled"]` manifest label NOT consumed; description NEVER read by the rider path.

## Consumer live key-only proof (code, unchanged)
- `buildHitConditionClause` MonsterCardHelpers.js:561 — reads `action.hit_conditions` + `action.escape_dc` keys ONLY; keys absent → returns null (byte-inert).
- `applyHitClauseConditions` handlePlainDamage.js:512 — on resolved hit writes activeConditions + activeConditionMeta{dc,ability:'str',source} + `condition applied` log with escape DC. Live twins: MA-0010 Aberrant Cultist Tentacle Lash, MA-0621 dracolich Sickening Ray, MA-0763/0791/0794 poison riders, MA-0796 constrictor save-leg grapple (separate seam).

## Live E2E (test-campaign ONLY, header verified; dev :5173)
Rig: EB join exact td "Giant Crab"+"Bandit"; cs: Giant Crab 1 idx0 (13/13 AC15 Medium), Bandit 1 AC12 "Medium or Small" ✓ (Medium-or-smaller RAW gate satisfiable); Bandit maxHp/currentHp 999 full-store cs POST (read-back 999/999); crab OWN initiative-card target-select → Bandit 1 re-armed before every click (§118/§148).
- 5 chips fired (one absorbed first-click §138): nat6✗9, nat18✓21, nat3✗6, nat12✓15, nat7✗10 vs AC12 — honest boundary straddle (hit iff nat≥9).
- Ledger 2 hits: ONE `roll damage` each, formula **"1d6 + 1" Bludgeoning byte-exact**, dice [4]→fd5, [1]→fd2 distinct (§77); hpΔ −5/−2 exact 999→994→992; misses ZERO damage entries (§94 Done-less); note:"combined_damage_roll" cosmetic single-primary (§183); lastAttack.damageFormula "1d6 + 1", saveDc/saveType null (§156 attack rides no save).
- FAIL(a) axis: Grappled NEVER granted — whole-log `condition applied`==0, /grappl|escape/i scan==0, Bandit change-data `activeConditions`/`activeConditionMeta` KEYS ABSENT after 2 hits, top-level `targetEffects` null. Medium-or-smaller victim gate is moot — clause null upstream (key absent), never reaches gate.
- Console 0 errors.

## Fix (DATA, two fields)
Author `"hit_conditions":["grappled"]` + `"escape_dc":11` on giant-crab actions[0] (MA-0010 byte-shape; escape DC 11 = STR, 8+STR1+PB2 ✓ RAW). Consumer live — no code change. Description already byte-carries "escape DC 11"; Medium-or-smaller gate: handler grants unconditionally like MA-0795-family twins (advisory: no size-conditional clause consumer §70-class, Medium victim honest).

## Ops notes (NEW, brief)
- Giant Crab card renders exactly ONE "+3" chip (§116 correct); chip click via mouse at fresh rect lands EXCEPT after a card reopen cycle — first post-reopen click absorbed (§138 twin), retry same rect fires.
- EB filter "Bandit" surfaces 4 Bandit* rows + hidden checked Giant Crab in strip — exact td-text anchoring mandatory (§124/§164 re-confirmed).
