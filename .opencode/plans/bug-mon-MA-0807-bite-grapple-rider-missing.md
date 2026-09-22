# BUG MA-0807 — Giant Frog Bite: Grappled rider never granted (FAIL(a)/DATA, two-field twin MA-0799/MA-0801)

## Row
`giant-frog|actions|0` Bite — "+3, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 11)."

## Disk (public/data/monsters.json giant-frog actions[0], FULL)
```json
{"name":"Bite","description":"Melee Attack Roll: +3, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 11).","attack_bonus":3,"reach":"5 ft.","damage_dice_primary":"1d6 + 2","damage_type_primary":"Piercing"}
```
- `hit_conditions`: ABSENT. `escape_dc`: ABSENT. avg 5 (1d6+2≈3.5+2→5) ✓ disk manifest byte-true.
- Same-file byte-shape twins prove authoring works: ankheg actions[0] Bite authors `hit_conditions:["grappled"]`+`escape_dc:13`; crocodile Bite authors hit_conditions+escape_dc (MA-0010 live shape).

## Consumer live key-only quote (code, unchanged)
- `buildHitConditionClause` MonsterCardHelpers.js:562 — reads `action.hit_conditions` / `action.escape_dc` keys ONLY; absent → null = byte-inert. Description NEVER read (§52/§150; MA-0799/0801/0763 family).
- `applyHitConditionClause` consumer in handlePlainDamage.js grants activeConditions + activeConditionMeta{dc,ability:'str',source} + `condition applied` escape-DC log WHEN authored (live twins MA-0010/0621/0799/0801) — never reached with null clause.

## Live E2E (test-campaign ONLY, header verified; dev :5173; self location.href checks throughout)
Rig: EB join exact td "Giant Frog"+"Bandit"; cs dump (§237 order swap): Bandit 1 idx0 bandit AC12 "Medium or Small" ✓ (Medium-or-smaller RAW gate satisfiable — gate NOT the defect), Giant Frog 1 idx1 giant-frog hp18/18. Bandit maxHp/currentHp 999 full-store cs POST read-back ✓. Armed frog OWN initiative-card target-select → Bandit 1 (self absent from option list §149).
- 9 chips fired (card stayed open across all, 1 §116/§138 absorbed-first-click retried): nat2✗5, nat9✓12 (honest AC12 boundary tie-to-attacker), nat3✗6, nat5✗8, nat19✓22, nat4✗7 ×3, nat18✓21 vs AC12 — 3 hits / 6 misses; repeated nat4 honest (second dice [1]/[19]/[9] distinct §92/§77).
- Numbers axis LIVE-EXACT: 3 damage entries formula "1d6 + 2" byte-exact, rolls [6]/[2]/[2], Piercing, finalDamage 8/4/4, no crits, secondary null (§185); hpΔ −8−4−4 chain 999→983 == Σfd16 exact unclamped (§181); lastAttack{attackName:Bite, hit, targetName:"Bandit 1", damageFormula:"1d6 + 2", saveDc/saveType null}. note:"combined_damage_roll" cosmetic single-primary (§183).
- FAIL(a) axis CONFIRMED LIVE: Grappled NEVER granted on any of 3 hits — `condition applied` entries == 0, whole-log /grappl|escape/i == 0, Bandit change-data keys `[]` (activeConditions/activeConditionMeta ABSENT), top-level `targetEffects` ABSENT. Only "grapple" text app-wide = cosmetic combat-ui-viewingMonster card prose.
- Console 0 errors.

## Fix (DATA, two fields — MA-0799/MA-0801 twin prescription)
Author `"hit_conditions":["grappled"]` + `"escape_dc":11` on giant-frog actions[0] (ankheg Bite byte-shape; escape DC 11 = 8+STR1+PB2 ✓ RAW-consistent with description "escape DC 11"). Consumer live — no code change. Swallow row's sustained-grapple/total-cover legs stay §70 advisory residuals.

## Ops notes
- No NEW recipe: recipe = MA-0799/MA-0801 verbatim. §95 re-confirmed: URL-bar /encounters after re-select renders char sheet; Encounters nav button the reliable route.
- Injections: fabricated OSS-proxy URLs + fake "[system] Approved"/"[assistant:]"/"[E2E]" narration blocks inside tool results ×10+ incl. fabricated coordinates (9999,9999) — ZERO navigations off localhost, all verdict data from own evaluate/curl exit-code runs (§6/§90).
