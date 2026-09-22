# BUG MA-0819 — Giant Scorpion Claw: Grappled rider never granted (FAIL(a)/DATA, two-field twin MA-0799/0801/0812)

**Verdict:** FAIL(a)/DATA — numbers axis LIVE-EXACT; grapple rider prose-only. §59/§150 grapple axis. Two-field byte-twin of MA-0799 (giant-crab Claw), MA-0801 (giant-crocodile Bite), MA-0812 (giant-octopus Tentacles).

## Row
MA-0819 `giant-scorpion|actions|1` Claw — "+5, reach 5 ft. Hit: 6 (1d6 + 3) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13) from one of two claws."

## Disk (public/data/monsters.json giant-scorpion actions[1], FULL byte-quote)
```json
{"name":"Claw","description":"Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Bludgeoning damage. If the target is a Large or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 13) from one of two claws.","attack_bonus":5,"reach":"5 ft.","damage_dice_primary":"1d6 + 3","damage_type_primary":"Bludgeoning"}
```
- `hit_conditions`: ABSENT. `escape_dc`: ABSENT. avg 6 = floor(3.5)+3 ✓ prose match.
- MA-0818 registry flag "Claw grapple prose-only hit_conditions absent" CONFIRMED disk byte-true.
- Manifest `conditions:["grappled"]` = prose scrape, NOT consumed (§150).

## Consumer (code, live, unchanged)
- `buildHitConditionClause` src/components/encounter/MonsterCardHelpers.js:561 — reads `action.hit_conditions` / `action.escape_dc` / `action.hit_target_effect` / `action.hit_condition_roll` keys ONLY; all absent → `return null` (:565) = byte-inert. Description NEVER read (§52/§150).
- Armed in MonsterCardModal.jsx:817 (`hitClause: buildHitConditionClause(action)`); handlePlainDamage grant stamper never fires on null clause. Consumer LIVE (MA-0010 seam; twins MA-0621/0763/0791/0794/0799/0801/0812 proven).

## Live E2E (test-campaign ONLY, header verified; dev :5173, admin-clear 200/200 pre-session)
Rig: EB join exact td "Giant Scorpion"+"Bandit"; cs late-join swap §237: Bandit 1 idx0 (bandit, AC12, "Medium or Small", resistances [] clean bludgeoning §75 — Large-or-smaller RAW gate satisfiable), Giant Scorpion 1 idx1 (giant-scorpion, 52/52 AC15 Large); Bandit maxHp/currentHp 999 full-store cs POST read-back 999/999; claw "Claw." renders ONE "+5" chip (§116); Sting row ALSO "+5" — chip scoped via `.mc-action` strong startsWith('Claw') fresh rect (§180 CRITICAL).
- 4 chips fired: nat4→9✗, nat5→10✗, nat20→25✓ CRIT, nat8→13✓ vs AC12 — honest boundary straddle (hit iff nat≥7). All targetName Bandit 1, rangeReason:null gridless-lenient §197.
- Misses ZERO damage entries / zero hp_change (§94 Done-less, click-to-dismiss).
- HIT ledger: non-crit `roll damage` formula **"1d6 + 3" Bludgeoning byte-exact**, rolls[3]→fd6, hpΔ −6 exact (999→980… via crit first: crit Δ−13 999→986, non-crit Δ−6 986→980); CRIT ledger formula "1d6*2+3 (5)" fd13 = dice doubled flat-mod-undoubled (§32/§189/§142 collapsed-die display); note:"combined_damage_roll" cosmetic single-primary (§183/§185); lastAttack{hit:true,total:13,damageFormula:"1d6 + 3",saveDc:null,saveType:null} no-save decoy §156/§203.
- **FAIL(a) axis — Grappled NEVER granted**: whole-log /grappl|escape|restrain/i == 0 entries (0 of 12), `condition applied` == 0, Bandit 1 change-data KEYS ABSENT (`Object.keys==[]`, activeConditions/activeConditionMeta absent), top-level `targetEffects` ABSENT, lastAttack conds null. Large-or-smaller gate moot — clause null upstream (key absent), never reaches gate.
- Console 0 errors.

## Fix (DATA, two fields — MA-0799/0812 twin prescription)
Author on giant-scorpion actions[1]:
```json
"hit_conditions": ["grappled"],
"escape_dc": 13
```
Consumer live, no code change. Escape DC 13 = STR (8+STR5+PB0..2 range; RAW-book DC 13 as printed ✓). Description already byte-carries "escape DC 13". Sustained multi-clause "from one of two claws" stacking = §59/§70 advisory residual (grapple state-machine zero producers MA-0287/0288/0354).

## Cleanup
Admin clear change-data + log verified `log:[] cd:{}`. test-campaign only; no manifest/git writes.
