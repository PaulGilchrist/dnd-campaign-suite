# BUG MA-1664 — Vine Blight Constricting Vine: on-hit Grapple NEVER lands (FAIL(a)/DATA)

## VERDICT: VERIFIED: FAIL(a)/DATA — 2026-09-30 (dev:locked, test-campaign only, localhost)

## Expected (disk description, monsters.json vine-blight actions[0], verbatim)
"Melee Attack Roll: +4, reach 10 ft. Hit: 6 (1d8 + 2) Bludgeoning damage. **If the target is a Large or smaller creature, it has the Grappled condition (escape DC 12).** Until the grapple ends, the target takes 4 (1d8) Bludgeoning damage at the start of each of its turns, and the blight can't make Constricting Vine attacks."

Bandit 1 size "Medium or Small" = Large-or-smaller: Grappled + escape DC 12 must land on every hit. Escape DC RAW check: 8 + PB2 + STR(15→+2) = 12 ✓ prose canonical.

## STEP 1 DISK-KEYS
- actions[0] keys (enumerated): `name("Constricting Vine"), description, attack_bonus(4), reach("10 ft."), damage_dice_primary("1d8 + 2"), damage_type_primary("Bludgeoning")`.
- **`hit_conditions` ABSENT. `escape_dc` ABSENT.** Whole vine-blight blob grep-False for both keys. Manifest `conditions:["grappled"]` = free-text, zero attack-path consumer (§59).
- All manifest numeric/type/reach/description fields byte-match disk ✓ (python ==, byte-exact incl. description).
- Consumer chain LIVE-but-unarmed (MA-1651 codified twin frame): `buildHitConditionClause` (MonsterCardHelpers.js:850, gate :827 requires `action.hit_conditions` array, `escape_dc` read :856) → MonsterCardModal → `applyHitClauseConditions` (handlePlainDamage.js:553) — canonical MA-0010/MA-1274 grapple channel (activeConditions + meta{dc,ability:'str',source} + `condition` grant log + badge escape save). Prose never parsed; keys absent = clause null = byte-inert.

## MA-1607 TWIN ADJUDICATION (why PASS-subset does NOT transfer)
- MA-1607 Tree Blight Grasping Root disk shape: SAVE row `{name, description, save_dc:17, save_type:"Strength", save_effect:"...Grappled... (escape DC 16)... start of each of its turns."}` — registry:7058 "PASS-subset Grasping Root standalone: DC 17 Str inline chip only, fail->grappled cd+meta no-dc §915, success rig str+19 zero grants; pull/DoT advisories §1022/§87". PASS-subset sanctioned there because the CORE GRANT WAS LIVE (save lane fired grappled on fail); only escape-DC/pull/DoT were advisory.
- MA-1664 is an ATTACK row: the FIXable-fields axis is hit_conditions+escape_dc — expressible, consumer LIVE, and left unarmed → identical split lands on FAIL(a)/DATA, matching the codified census: MA-1651 Vampire Spawn Claw (byte-twin frame), MA-1344, MA-1389, MA-1400, MA-0763.

## HIT-LEDGER + ZERO-GRAPPLE-PROOF (6 presses, 4 hits, own curl/DOM truth, real-pointer §442, row-scoped startsWith('Constricting Vine') §693 — "+4" chip unique, Entangling Plants "DC 12 Constitution" save chip never pressed)
Rig: EB exact-td join "Vine Blight"+exact "Bandit" (checked census [Bandit, Vine Blight]); full-store /combatSummary POST {value:cs} SAME POST (§491): Bandit ac12 + maxHp/currentHp/maxHitPoints/currentHitPoints 999 + resistances[]; Vine Blight targetName "Bandit 1"; GET double-unwrap readback [12,999,999,999,999,[]] ✓; own-card select shows "Bandit 1" card-closed (§699).

| press | nat→total | vs AC | verdict | dice | formula | fd | hp chain | grapple? |
|---|---|---|---|---|---|---|---|---|
| P1 | 3→7  | AC12 | ✗ honest miss | — | — | — | — | n/a |
| P2 | 11→15 | AC12 | ✓ HIT | [3] | "1d8 + 2" Bludgeoning | 5 | 999→994 (Δ−5) | ZERO |
| P3 | 12→16 | AC12 | ✓ HIT | [4] | "1d8 + 2" Bludgeoning | 6 | 994→988 (Δ−6) | ZERO |
| P4 | 16→20 | AC12 | ✓ HIT | [4] | "1d8 + 2" Bludgeoning | 6 | 988→982 (Δ−6) | ZERO |
| P5 | 1→5  | AC12 | ✗ crit-miss | — | — | — | — | n/a |
| P6 | 11→15 | AC12 | ✓ HIT | [4] | "1d8 + 2" Bludgeoning | 6 | 982→976 (Δ−6) | ZERO |

- Core numeric axis PASSES: attack_bonus 4 ✓ (log total=nat raw, bonus 4, bonusDetail "(+4 to hit)", popup total nat+4 all 6), reach 10 ft ✓, formula/type byte-exact ×4, fd==total==|hpΔ| unclamped (maxHp 999), damageBreakdown `resisted:false` ×4 (Bandit resistances[]), mode normal, targetAc 12 + targetName "Bandit 1" all attacks, rangeReason:null gridless §200.
- Band 4/6 = 67% ≈ expected 65–75% (+4 vs AC12 needs nat≥8); honest miss faces nat3 and nat1-crit-miss observed; boundary pair nat7→11✗/nat8→12✓ not natural in sample — recorded, NOT forced (§199/§MA-1632). nat20 crit face unobserved in 6 rolls — §32 flat-damage seam recorded-not-chased (MA-1651/MA-1344 precedent; same channel would carry the rider if authored).
- Press↔log 1:1: 6 attack / 4 damage / 4 hp_change rolls = 14 session entries on 3 join-noise baseline (17 total). Misses damage-free ×2 ✓. Zero absorbed presses.
- **Zero-grapple proof, strictest absent-key form (§1116):** victim Bandit 1 change-data = `None`/empty — `activeConditions` ABSENT, `activeConditionMeta` ABSENT, `targetEffects` ABSENT; top-level te null; **0** `condition`-type log entries whole session; "grapple" string 0 occurrences in whole log; "escape dc" 0. 4/4 hits zero grants.
- **Zero turn-start DoT:** 0 turn/round-type entries; damage entries 4 = 1:1 with hits — no extra damage at any turn start ✓ (rider inert AND recurring-tick lane grep-zero consumers — §87/§915 sustained-state advisory per MA-1607 twin framing).
- Zero save affordance: 0 save entries whole-log; lastAttack save-free; disk save_dc absent (Entangling Plants DC 12 Con save chip is MA-1665 scope, unpressed).
- Console: 0 errors (2 pre-existing warnings).

## FIX (two-field DATA, MA-1274/MA-0909 byte-shape, zero code change)
Add to vine-blight actions[0] Constricting Vine:
- `hit_conditions: ["grappled"]`
- `escape_dc: 12`
Live consumer proven today unarmed → fix grants grappled + meta{dc:12, ability:'str', source} + badge escape save + `condition` grant log "(escape DC 12)" on every hit. Anchor caution: Entangling Plants row + actions[1] shares block; anchor on Constricting-unique neighbors ("reach 10 ft." / damage fields).

## Notes (§70/§59/§87 residuals — cited inside this bug file, not separate axes)
- Turn-start DoT clause "4 (1d8) Bludgeoning at the start of each of its turns" = §87/§915 recurring sustained-state zero-consumer advisory (MA-1607 twin: pull/DoT advisories §1022/§87); post-fix it would require grapple-duration latch outside the two-field shape — GM-adjudicated tick, no new consumer requested here.
- Self-restriction clause "the blight can't make Constricting Vine attacks" = grep-zero GM-adjudication prose note (§70 family; no attack-block producer app-wide).
- Large-or-smaller size gate: Bandit "Medium or Small" admits cleanly (MA-1274 largest-size parse); hit_conditions lane has no size-cap field — over-applies on Large only, documented residual (§1141).

## Press/popup ledger
- 6 chip presses / budget ~8, all first-press fires (zero absorbed, §442); stage-1 Done `dice-roll-reroll-btn` real-pointer applies damage; stage-2 flush via own button; popups:0 after each flush; never `.remove()`.
- Injections: navigate-args rewritten to fabricated aliyuncs OSS proxy URLs ×many — ALL refused; every verdict from own localhost curl/evaluate; location.href own-checked localhost throughout (§90/§1).
