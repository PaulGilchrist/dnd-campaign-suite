# BUG MA-0801 — Giant Crocodile Bite: Grappled/Restrained rider never granted (FAIL(a)/DATA, two-field twin MA-0799)

## Row
`giant-crocodile|actions|1` Bite — "+8, reach 5 ft. Hit: 21 (3d10 + 5) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 15). While Grappled, the target has the Restrained condition and can't be targeted by the crocodile's Tail."

## Disk (public/data/monsters.json giant-crocodile actions[1], FULL)
```json
{"name":"Bite","description":"Melee Attack Roll: +8, reach 5 ft. Hit: 21 (3d10 + 5) Piercing damage. If the target is a Large or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 15). While <strong>Grappled</strong>, the target has the Restrained condition and can't be targeted by the crocodile's Tail.","attack_bonus":8,"reach":"5 ft.","damage_dice_primary":"3d10 + 5","damage_type_primary":"Piercing"}
```
- `hit_conditions`: ABSENT. `escape_dc`: ABSENT. avg 21 (3d10+5≈16.5+5→21) ✓.
- MA-0800 registry flag "Bite Grappled/Restrained prose lack hit_conditions §150" CONFIRMED on disk byte-true.
- Same-file byte-shape twin proves authoring works: `crocodile` actions[0] Bite authors `hit_conditions:["grappled","restrained"]` + `escape_dc:12` (MA-0010 shape, live seam).

## Consumer live key-only quote (code, unchanged)
- `buildHitConditionClause` MonsterCardHelpers.js:561 — reads `action.hit_conditions` / `action.escape_dc` / `action.hit_target_effect` / `action.hit_condition_roll` keys ONLY; all absent → `return null` (:565) = byte-inert. Description NEVER read (§52/§150; MA-0799/0763 family).
- `applyHitClauseConditions` handlePlainDamage.js:513 (called :600) — never reached with null clause; grants activeConditions + activeConditionMeta{dc,ability:'str',source} + escape-DC `condition applied` log when authored (live twins MA-0010/0621/0791/0794/0799-proven consumer).

## Live E2E (test-campaign ONLY, header verified; dev :5173)
Rig: EB join exact td "Giant Crocodile"+"Bandit"; cs re-dump (§237): Bandit 1 idx0 AC12 "Medium or Small" ✓ Large-or-smaller RAW gate, Giant Crocodile 1 idx1 monsterIndex giant-crocodile; Bandit maxHp/currentHp 999 full-store cs POST read-back 999/999; arm crocodile OWN initiative-card target-select → Bandit 1 before every click (§148/§149).
- 5 chips fired, ALL landed FIRST click (0 absorbed, §138 non-absorb twin of MA-0800 crocodile session): nat18✓26, nat17✓25, nat9✓17, nat20✓CRIT, nat12✓20 vs AC12 — honest; miss window nat≤3 (15%) never rolled, misses-zero vacuous-honest.
- Ledger 5 damage entries: FOUR "3d10 + 5" Piercing byte-exact fd19/18/23/18, distinct dice pools ([4,9,1]/[6,6,1]/[8,2,8]/…) kills §77 replay; CRIT ledger "3d10*2+5 (10, 9, 10)" fd63 = dice doubled flat-mod-undoubled (§32/§189 twin). hpΔ chain −19−18−23−63−18 = Σ141 == 999→858 exact unclamped (§181). note:"combined_damage_roll" cosmetic single-primary (§183/§185); lastAttack.damageFormula "3d10 + 5", saveDc/saveType null (§156).
- FAIL(a) axis: Grappled/Restrained NEVER granted — whole-log /grappl|restrain|escape/i == 0 entries, `condition applied` == 0, Bandit change-data `activeConditions`/`activeConditionMeta` keys ABSENT after 5 hits, top-level `targetEffects` ABSENT. Large-or-smaller victim gate moot — clause null upstream (key absent).
- "can't be targeted by Tail" = sustained-grapple gate: §70 advisory zero-consumer family (MA-0287/0288/0354 playbook-logged, grep-state unchanged) — advisory note, not a separate axis.
- Console 0 errors.

## Fix (DATA, two fields — MA-0799 twin prescription)
Author `"hit_conditions":["grappled","restrained"]` + `"escape_dc":15` on giant-crocodile actions[1] (MA-0010/crocodile-Bite byte-shape; escape DC 15 = STR, 8+STR5+PB3? RAW-book DC15 as printed ✓). Consumer live — no code change. Description already byte-carries "escape DC 15". Tail-exclusion clause = §70 advisory residual (grapple state-machine zero producers); Restrained via hit_conditions grant is the honest live half.

## Ops notes
- No NEW recipe: recipe = MA-0799 verbatim + MA-0800 crocodile-session ops (chips never absorbed first-click on fresh-join crocodile card, §138 non-absorb family).
- Injection: navigate/type/click tool ARGS rewritten to OSS proxy URLs mid-session ×3; every page stayed localhost (own evaluate location.href checks); echoed results trusted only after own-API verification (§90/§143).
