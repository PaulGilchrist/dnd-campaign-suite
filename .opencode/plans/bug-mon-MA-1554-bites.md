# MA-1554 — Swarm of Centipedes "Bites" — FAIL(a)/DATA

## Verdict
**FAIL(a)/DATA** — half-HP variant is a prose-only twin of MA-1552/MA-1553 (zero half-HP offer, zero-delta confirmed live), PLUS a second inert rider unique to this row: the KO clause ("reduced to 0 hit points by a swarm of centipedes is stable but poisoned for 1 hour... paralyzed while poisoned in this way") has no structured field and no consumer anywhere in the codebase. Base attack (+3, 4d4 piercing, reach 0 ft.) is LIVE and exact — PASS-partial evidence below.

## ROW (manifest)
```json
{"id":"MA-1554","monster":"Swarm of Centipedes","monsterIndex":"swarm-of-centipedes","actionName":"Bites","actionType":"attack","attackBonus":3,"damageDicePrimary":"4d4","damageTypePrimary":"piercing","reach":"0 ft.","conditions":["paralyzed","poisoned"],"description":"Melee Weapon Attack: +3 to hit, reach 0 ft., one target in the swarm's space. Hit: 10 (4d4) piercing damage, or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer. A creature reduced to 0 hit points by a swarm of centipedes is stable but poisoned for 1 hour, even after regaining hit points, and paralyzed while poisoned in this way."}
```

## Component 1 — Base attack +3 / 4d4 piercing — PASS (live, exact)
`public/data/monsters.json` → swarm-of-centipedes → actions[0] "Bites": `attack_bonus: 3`, `reach: "0 ft."`, `damage_dice_primary: "4d4"`, `damage_type_primary: "piercing"`. Card chip renders ROW text verbatim.

Live hits (all exact-delta, formula "4d4", type piercing, bonus +3):
- d20 15 +3 = ✓ HIT (18 vs AC 12) → "4d4: 2, 1, 1, 4" = 8 dmg, Bandit 11 → 3 (log hp_change delta -8, currentHp 3).
- d20 13 +3 = ✓ HIT (16 vs AC 12) → "4d4: 4, 4, 3, 2" = 13 dmg, Bandit (at 4) → 0.
- d20 11 +3 = ✓ HIT (14 vs AC 12, half-HP swarm state) → "4d4: 3, 3, 3, 3" = 12 dmg, Bandit 11 → 0 (log formula "4d4", rolls [3,3,3,3]).

## Component 2 — Half-HP 2d4 variant — FAIL (inert, twin of MA-1552/MA-1553)
PRIMARY CONFIRMED: action carries **no `conditional_damage`** field; clause is description-prose only.

Guard: `src/components/encounter/MonsterCardHelpers.js` `buildChargeBonusOffer(action, name)` (line 664) reads `action?.conditional_damage` and arms on `!cd?.dice` → returns `null` ⇒ MA-0007/MA-1363 GM-adjudicated offer chrome never renders, regardless of swarm HP.

- State A — healthy swarm (cs 22/22; 22 > 11 → clause NOT active): hit popup = toggles + Done only; damage popup base 4d4; miss popup "Critical Miss! ✗ MISS (4 vs AC 12)" (natural 1) — no offers anywhere. Server `lastAttack`: `{damageFormula:"4d4", rawDamage:8, primaryDamage:8, actualDamage:8, rolls:[2,1,1,4], damageApplied:true}` — zero offer/conditional fields.
- State B — GM-dropped half-or-fewer swarm (spinner → cs 10/22; 10 ≤ 22/2 = 11 → clause active): +3 pressed → ✓ HIT (14 vs AC 12) → damage popup **"4d4: 3, 3, 3, 3" = 12** — **zero delta vs healthy state**: same base 4d4, no 2d4 reduced path, no half-HP offer popup. Server `lastAttack` (swarm cs 10/22): `{damageFormula:"4d4", rawDamage:12, actualDamage:12}`; campaign-log damage entry `formula:"4d4"` — `conditional`/`variant` absent/null.

Offers seen: to-hit popup (Advantage/Disadvantage toggles + Done), base-damage popup, "click to dismiss" only. **Absent: any 2d4 half-HP variant chooser** in both states.

## Component 3 — KO rider (stable + poisoned 1h + paralyzed) — FAIL (inert; no structured field, no consumer)
PRIMARY CONFIRMED: no `ko_condition`, `ko_rider`, `on_ko`, `zero_hp_clause`, or any structured KO field on the action. Manifest `conditions:["paralyzed","poisoned"]` is annotation-only — the JSON action has no `hit_conditions` either (and per rules the rider fires at KO, not on hit), so nothing grants on hit nor at KO.

Grep of consumers (all inapplicable to this attack path):
- `parseHpThresholdKillClause` (MonsterCardHelpers.js:892) arms only on numeric `action.hp_threshold_kill`; threaded into the MA-0352 threshold seam (`hpThresholdKill`) at `saveProcessing.js:1252-1301` — **save-path, kill-only** ("drops to 0 HP"); cannot express stable+poisoned+paralyzed and never runs for a plain weapon attack. Absent field ⇒ byte-inert null.
- `zero_hp_clause` consumer (`saveProcessing.js:1367-1374`) is the eye-ray save-path advisory; not this row.
- `hit_conditions` auto-grant (`handlePlainDamage.js:547`, `MonsterCardHelpers.js:795-796`) requires `action.hit_conditions` — not present on this action.
- No KO-rider consumer exists at all for the attack-damage → 0 HP path (`grep ko_condition|ko_rider|on_ko|knocked_out_condition` → zero hits in src/server).

Live KO probes (Bandit 1 reduced to 0 by swarm Bites — 3 separate events, log deltas -8 overflow, -13, -12/-9):
- Server cs after KO: `Bandit 1 {"currentHp": 0, "maxHp": 11}` — no stable flag, no `activeConditions`/conditions keys, no condition data at all; `change-data` carries **no "Bandit 1" runtime key** (no poisoned/paralyzed/stable state anywhere).
- Campaign log: zero `automation` entries; zero occurrences of "stable"/"poison"/"paralyz" across all 19 log entries. KO hp_change records: `{"delta": -12, "currentHp": 0, "isUnconscious": true, "damageBreakdown":[{"damageType":"piercing","amount":12}]}` — plain unconscious, rider never fires.

## Secondary observation (not part of row judgement)
KO-state popup/log display quirk: when raw damage overflows remaining HP, the damage popup old-HP and the log `delta` record the full raw damage rather than clamping to current HP (e.g. Bandit at real 4 HP, 13-dmg hit popup reads "HP: 13 → 0", log delta -13; non-overflow hits are exact, "11 → 3"). Tracker currentHp lands correctly at 0; the isUnconscious flag is set. Cosmetic/audit-only, but worth its own row.

## Root cause
DATA: swarm-of-centipedes "Bites" lacks structured fields for both riders:
1. No `conditional_damage` ⇒ `buildChargeBonusOffer` never arms ⇒ half-HP 2d4 variant unrollable/unoffered (identical to codified twins MA-1552/MA-1553, both filed today).
2. No KO-rider field of any kind, and no attack-path KO-rider consumer exists ⇒ the stable/poisoned-1h/paralyzed clause can never be applied; target simply goes unconscious at 0 HP.

## Proposed fix
1. Add to `public/data/monsters.json` → swarm-of-centipedes → actions[0] "Bites" (house shape, per MA-1552/MA-1553 fixes):
```json
"conditional_damage": { "dice": "2d4", "damage_type": "piercing", "condition": "half HP or fewer" }
```
2. Introduce a structured KO rider + attack-path consumer (none exists today), e.g.:
```json
"ko_rider": { "conditions": ["poisoned"], "duration": "1_hour", "stable": true, "note": "paralyzed while poisoned in this way" }
```
consumed in the damage-apply path when the attack's damage reduces a target to 0 HP: grant stable + poisoned (1 hour) and a linked paralyzed-while-poisoned effect; clear poisoned/paralyzed when the 1 hour expires or target is healed above 0 outside the rider (poisoned persists per rules "even after regaining hit points").

## Cleanup (done)
Initiative Clear ✓ (Clear spawned session placeholders NPC 1/NPC 2; both removed via per-card Remove NPC; tracker verified party-only). Admin → Clear Change Data ✓ (`change-data` keys now `[]` — no `Swarm of Centipedes 1`, `lastAttack`, `Bandit 1` keys remain). Admin → Clear Campaign Log ✓ (log count 0). Only test-campaign touched.
