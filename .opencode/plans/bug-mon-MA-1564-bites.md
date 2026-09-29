# MA-1564 — Swarm of Quippers "Bites" — VERDICT: FAIL(a) / DATA

## Row
```json
{"id":"MA-1564","monster":"Swarm of Quippers","monsterIndex":"swarm-of-quippers","actionName":"Bites","actionType":"attack","attackBonus":5,"damageDicePrimary":"4d6","damageTypePrimary":"piercing","reach":"0 ft.","description":"Melee Weapon Attack: +5 to hit, reach 0 ft., one creature in the swarm's space. Hit: 14 (4d6) piercing damage, or 7 (2d6) piercing damage if the swarm has half of its hit points or fewer."}
```

## Components verdict
1. **Base +5 / 4d6 piercing, reach 0 ft. — PASS (live exact).** Card shows `+5` dice link + full prose; attacks roll d20+5 vs Bandit AC 12; every HIT pays base `4d6` piercing exact.
2. **Bloodied half-HP variant 2d6 piercing — inert (FAIL(a)/DATA).** Prose-only; no `conditional_damage` on the manifest action → `buildChargeBonusOffer` (`src/components/encounter/MonsterCardHelpers.js:666`, `const cd = action?.conditional_damage; if (!cd?.dice) return null;`) returns null forever → bloodied press pays base 4d6 with zero delta. Twin of prose-only bloodied-variant lineage MA-1552/1553/1557/1558/1559/1561/1562.

## Static evidence
- `public/data/monsters.json` swarm-of-quippers Bites keys: `name, description, attack_bonus (5), reach ("0 ft."), damage_dice_primary ("4d6"), damage_type_primary ("piercing")` — **NO `conditional_damage`**. The half-HP 2d6 clause lives only in `description` prose.
- Guard: `src/components/encounter/MonsterCardHelpers.js:666` — `if (!cd?.dice) return null;` (offer chrome can never appear without the structured field).

## E2E evidence (localhost:5173, test-campaign, Playwright)
- Header verified `test-campaign`. EB exact "Swarm of Quippers" + "Bandit" (checkboxes checked, qty 1 each) → Join Encounter. Tracker: Bandit 1 AC 12 HP 11/11 init 17; Swarm of Quippers 1 HP 28/28 init 15. Swarm Target combobox = "Bandit 1" (change-data `creatures[1].targetName = "Bandit 1"`). Card (second click after §138 absorb) shows `Bites. [+5]` with exact prose incl. reach 0 ft.
- **Step 1 — healthy swarm (28/28) vs Bandit AC 12:**
  - Press 1: d20 nat 20 → `Critical Hit! — damage dice doubled` `✓ HIT (25 vs AC 12)` → damage popup `4d6*2 (1, 5, 3, 1)` = 20 piercing, hp_change −20 applied (`lastAttack.rawDamage=20, damageApplied=true`).
  - Press 2 — **normal hit exact**: d20 16 +5 = `✓ HIT (21 vs AC 12)` → damage popup `4d6: 5, 2, 5, 1` = **13 piercing** (`log: formula "4d6", rolls [5,2,5,1], total 13; hp_change −13`).
  - Press 3 — **MISS captured (d20 ≤ 6)**: d20 nat 6 +5 = `✗ MISS (11 vs AC 12)` — clean: no damage popup, no hp_change, no offer chip (`log: rolls [6,4], total 6, hit False`).
- **Step 2 — bloodied swarm (GM HP set 14/28 = exactly half; change-data `currentHp 14/28`):**
  - Card re-open at half HP: **no offer chrome** — only the static prose line; no accept/decline controls, no "Bloodied:" chip, no variant dice selector.
  - Press d20 nat 19 +5 = `✓ HIT (24 vs AC 12)` → damage popup **base formula only** `4d6: 6, 1, 1, 6` = 14 piercing → Bandit down. **Zero-delta confirmed**: engine rolled 4d6, not the prose variant 2d6 (7 avg).
  - Full-log scan: `conditional_damage_granted` = **0**, `conditional_damage_declined` = **0**, any `conditional` mention = **0**. Half-HP state fully inert.
- Cleanup done: Initiative cleared (confirm accepted); Admin → Clear Change Data (keys **[]**) + Clear Campaign Log (**0 entries**).

## Fix
Add the half-HP bloodied variant as `conditional_damage` on swarm-of-quippers Bites in `public/data/monsters.json` (MA-0007 byte-shape, after `damage_type_primary`):

```json
"conditional_damage": { "dice": "2d6", "damage_type": "piercing", "condition": "half HP or fewer" }
```

Expected post-fix: bloodied HIT popup offers `Bloodied: +? 2d6 Piercing?`; accept rolls 2d6 piercing + logs `conditional_damage_granted`; decline logs `conditional_damage_declined` base-only; healthy/miss presses unchanged (base 4d6 piercing).
