# MA-1565 — Swarm of Rats "Bites" — VERDICT: FAIL(a) / DATA

## Row
```json
{"id":"MA-1565","monster":"Swarm of Rats","monsterIndex":"swarm-of-rats","actionName":"Bites","actionType":"attack","attackBonus":2,"damageDicePrimary":"2d4","damageTypePrimary":"Piercing","reach":"5 ft.","description":"Melee Attack Roll: +2, reach 5 ft. Hit: 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied."}
```

## Components verdict
1. **Base +2 / 2d4 Piercing, reach 5 ft. — PASS (live exact).** Card shows `+2` dice link + full prose; attacks roll d20+2 vs Bandit AC 12; every HIT pays base `2d4` Piercing exact.
2. **Bloodied half-HP variant 1d4 Piercing — inert (FAIL(a)/DATA).** Prose-only; no `conditional_damage` on the manifest action → `buildChargeBonusOffer` (`src/components/encounter/MonsterCardHelpers.js:666`, `const cd = action?.conditional_damage; if (!cd?.dice) return null;`) returns null forever → bloodied press pays base 2d4 with zero delta. Twin of prose-only bloodied-variant lineage MA-1552/1553/1557/1558/1559/1561/1562/1564.

## Static evidence
- `public/data/monsters.json` swarm-of-rats Bites keys: `name, description, attack_bonus (2), reach ("5 ft."), damage_dice_primary ("2d4"), damage_type_primary ("Piercing")` — **NO `conditional_damage`**. The bloodied 1d4 clause lives only in `description` prose.
- Guard: `src/components/encounter/MonsterCardHelpers.js:666` — `if (!cd?.dice) return null;` (offer chrome can never appear without the structured field).

## E2E evidence (localhost:5173, test-campaign, Playwright)
- Header verified `test-campaign`. EB exact "Swarm of Rats" + "Bandit" (checkboxes checked) → Join Encounter. Tracker: Bandit 1 AC 12 HP 11/11 init 20; Swarm of Rats 1 HP 14/14 init 16. Swarm Target combobox = "Bandit 1" (change-data `creatures[1].targetName = "Bandit 1"`). Card (first click absorbed §138) shows `Bites. [+2]` with exact prose incl. reach 5 ft.
- **Step 1 — healthy swarm (14/14) vs Bandit AC 12:**
  - Press 1 — **normal hit exact**: d20 nat 18 +2 = `✓ HIT (20 vs AC 12)` → damage popup `2d4: 4, 1` = **5 Piercing** (`log: formula "2d4", rolls [4,1], total 5; hp_change −5, HP 11→6`).
  - Press 2 — **normal hit exact**: d20 nat 19 +2 = `✓ HIT (21 vs AC 12)` → damage popup `2d4: 4, 3` = **7 Piercing** (`log: rolls [4,3], total 7; hp_change −7 → Bandit down at 0`; GM-revived to 11/11 via combatSummary POST for subsequent steps).
  - Press 3 — **MISS captured (d20 ≤ 9)**: d20 nat 7 +2 = `✗ MISS (9 vs AC 12)` — clean: no damage roll, no hp_change, no offer chip (`log: rolls [7,17], total 7, hit False`).
- **Step 2 — bloodied swarm (GM drop 14→7 = exactly half, cs math; change-data `currentHp 7/14`):**
  - Card re-open at half HP: **no offer chrome** — only the static prose line; no accept/decline controls, no "Bloodied:" chip, no variant dice selector.
  - Press A: d20 nat 6 +2 = `✗ MISS (8 vs AC 12)` — clean.
  - Press B — **bloodied HIT pays base only**: d20 nat 13 +2 = `✓ HIT (15 vs AC 12)` → damage popup **base formula only** `2d4: 1, 4` = 5 Piercing → Bandit 11→6. **Zero-delta confirmed**: engine rolled 2d4, not the prose variant 1d4 (2 avg); hit popup likewise carried no offer section.
  - Full-log scan: `conditional_damage_granted` = **0**, `conditional_damage_declined` = **0**, any `conditional` mention = **0**, any `bloodied` mention = **0**. Half-HP state fully inert.
- Cleanup done: Initiative cleared (confirm accepted); Admin → Clear Change Data (keys **[]**) + Clear Campaign Log (**0 entries****).**

## Fix
Add the bloodied variant as `conditional_damage` on swarm-of-rats Bites in `public/data/monsters.json` (MA-0007 byte-shape, after `damage_type_primary`):

```json
"conditional_damage": { "dice": "1d4", "damage_type": "Piercing", "condition": "Bloodied" }
```

Expected post-fix: bloodied HIT popup offers `Bloodied: +? 1d4 Piercing?`; accept rolls 1d4 Piercing + logs `conditional_damage_granted`; decline logs `conditional_damage_declined` base-only; healthy/miss presses unchanged (base 2d4 Piercing).
