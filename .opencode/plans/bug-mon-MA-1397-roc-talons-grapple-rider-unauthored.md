# bug-mon-MA-1397-roc-talons-grapple-rider-unauthored.md

**Row:** MA-1397 · `roc|actions|2` · Roc **Talons** (actions[2])
**Verdict:** FAIL(b)/DATA — ungated discrete-condition HIT rider (Grappled escape DC 19 + Restrained) inert because the disk row authors NEITHER `hit_conditions` NOR `escape_dc`.

## Disk row (verbatim, public/data/monsters.json roc actions[2])
```json
{"name":"Talons","description":"Melee Attack Roll: +13, reach 5 ft. Hit: 23 (4d6 + 9) Slashing damage. If the target is a Huge or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 19) from both talons, and it has the <strong>Restrained</strong> condition until the grapple ends.","attack_bonus":13,"save_dc":0,"save_type":"","save_effect":"","range":"","reach":"5 ft.","recharge":"","damage_dice_primary":"4d6 + 9","damage_type_primary":"Slashing"}
```
- `hit_conditions`: **ABSENT** (whole Roc block — Multiattack/Beak/Talons)
- `escape_dc`: **ABSENT**
- `conditions`: ABSENT (manifest claim `["grappled","restrained"]` not disk-true — §758 family)
- attack_bonus 13 = PB 4 + STR 9 ✓; escape DC 19 lives in PROSE ONLY.

## Consumer (live, unarmed)
`buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:673) reads `hit_conditions` / `hit_target_effect` / `hit_condition_roll` (+ `escape_dc` for the DC) → Roc Talons row carries none → clause `null` → `maybeApplyHitClause` (src/hooks/combat/handlers/handlePlainDamage.js:611) early-return; the grant machinery `applyHitClauseConditions` (:543, writes activeConditions + meta{dc,source} + reason "Talons (escape DC 19)" + `condition` log) never runs.

## Live evidence (test-campaign, 2026-09-27, localhost:5173)
Board: Roc 1 cs idx0 monsterIndex `roc` AC15 HP248 (EB re-join post-admin-clear) + Bandit AC12 clean resistances[] currentHp/maxHp 999 full cs POST; Roc own-card `targetName:"Bandit"` armed same POST body; triplet "+13" chips (§824) pressed row-scoped `strong.startsWith('Talons')`.

- **Press-to-log 1:1**: 16 presses → 16 attacks, 0 absorb.
- To-hit: every entry bonus:13, totals nat+13 exact; **AC-rig 19** (§887) boundary flip exact: nat6→19==AC19 `hit:true` vs nat3→16 `hit:false`; +13-vs-AC12 unmissable incl nat1→14 (§830).
- Damage: 15/15 hits, formula byte `4d6 + 9` Slashing, `sum(rolls)+9==finalDamage` every entry; **CRIT nat20**: formula `4d6*2+9 (6, 1, 4, 1)` rolls [6,1,4,1] fd 33 = dice-doubled, flat +9 undoubled (§32).
- Ledger: Σfd 341 == Σ|hpΔ| 341, chain 999→658 unclamped; 1 miss zero-damage zero-hpΔ.
- **RIDER ZERO on 15/15 hits**: whole-log `grapple|grappled` / `restrain` / `escape DC 19` grep FALSE; 0 condition entries; victim `Bandit` change-data STORE KEY **ABSENT** (§1116 strictest zero-grant proof); top-level `targetEffects` ABSENT; no badges.
- §117 decoy honest: zero save affordance — log types ONLY roll/attack, roll/damage, hp_change; `lastAttack.saveDc/saveType/dcSuccess` all null; `pendingSavePrompts` ABSENT (§1071 DC0 gate).
- Console: 0 errors.

## Adjudication
Reach 5 ft melee chip, rider gated only by target-size "Huge or smaller" — satisfiable for a normal Medium victim (Bandit rode the size parse cleanly on twins §687). Size-gate non-enforcement is §1274/§477 advisory and does NOT excuse zero-grant of the reachable ungated rider → per §MA-1344 / §MA-1357 / §MA-1389 precedent: **FAIL(b)/DATA**.

## Fix (two-field DATA, byte-shape twins)
Add to roc actions[2]: `"hit_conditions":["grappled","restrained"]` + `"escape_dc":19` (prose-canonical DC).
Twin census (grappled+restrained+escape_dc, exact pair): aberrant-cultist:14, chain-devil:14, crocodile:12, giant-crocodile:15, giant-octopus:13, lizardfolk-shaman:12, mezzoloth:14 (7 rows). Unarmed co-twins: purple-worm Bite (MA-1357), remorhaz Bite (MA-1389). Zero code needed (§754/§153).

## Residuals / notes
- "from both talons" count-stacking = GM-adjudicated (§66 class); gridless distance advisory (§42).
- Cleanup: admin-clear cd+log after session.
