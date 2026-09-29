# MA-1568 — Swarm of Spiders "Bites" — VERDICT: FAIL(a) / DATA

## Row
```json
{"id":"MA-1568","monster":"Swarm of Spiders","monsterIndex":"swarm-of-spiders","actionName":"Bites","actionType":"attack","attackBonus":3,"damageDicePrimary":"4d4","damageTypePrimary":"piercing","reach":"0 ft.","description":"Melee Weapon Attack: +3 to hit, reach 0 ft., one target in the swarm's space. Hit: 10 (4d4) piercing damage, or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer."}
```

## Components verdict
1. **Base +3 / 4d4 piercing — PASS (live exact).** All attacks fired with `bonus: 3`, `bonusDetail: "(+3 to hit)"`, vs Bandit 1 `effectiveAc: 12`; every non-crit HIT damage log carries `formula: "4d4"`, `damageType: "piercing"`.
2. **Half-HP variant 2d4 — inert (FAIL(a)/DATA).** Prose-only; `public/data/monsters.json` swarm-of-spiders Bites carries NO `conditional_damage` key → `buildChargeBonusOffer` (`src/components/encounter/MonsterCardHelpers.js:664-666`, `const cd = action?.conditional_damage; if (!cd?.dice) return null;`) returns null forever → half-HP press pays base 4d4 with zero delta. Twin of MA-1552/1553/1555/1557/1558/1559/1561/1562/1564/1565/1566 swarm fingerprint.

## Static evidence
- `public/data/monsters.json` swarm-of-spiders Bites keys: `name, description, attack_bonus (3), reach ("0 ft."), damage_dice_primary ("4d4"), damage_type_primary ("piercing")` — **NO `conditional_damage`**. The half-HP clause ("or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer") lives only in `description` prose.

## E2E evidence (localhost:5173, test-campaign, Playwright)
- Header verified `test-campaign`. EB exact "Swarm of Spiders" (CR 0.5, 100 XP) + "Bandit" (CR 0.125, 25 XP) — Selected Monsters (2), nothing else. Join Encounter: Swarm of Spiders 1 init 15, HP 22/22, AC 12; Bandit 1 init 13, HP 11/11, AC 12. First card click absorbed (§138); second opened modal. Swarm Target combobox = "Bandit 1" (change-data `targetName: "Bandit 1"` persisted).
- Card modal Bites row renders exact: chip `+3`, prose verbatim match incl. the half-HP clause.
- **Step 1 — healthy swarm (22/22) vs Bandit AC 12:**
  - Press 1: d20 3 +3 = `✗ MISS (6 vs AC 12)` — miss ≤8 ✓; no damage popup, no hp_change.
  - Press 2: d20 4 +3 = `✗ MISS (7 vs AC 12)` — miss ≤8 ✓.
  - Press 3: d20 9 +3 = `✓ HIT (12 vs AC 12)` → popup `4d4: 4, 2, 2, 4` = **12 piercing** → log `hp_change delta:-12` exact. Base 4d4 exact.
- **Step 2 — swarm ≤ half HP (GM HP 11/22 = exactly half, "half or fewer" satisfied):**
  - Press 4: d20 nat 20 → `Critical Hit!` HIT (23 vs AC 12) → damage log `formula "4d4*2 (2, 1, 2, 3)" total 16 finalDamage 16` — **BASE dice doubled, no half-HP substitution**.
  - Press 5: d20 6 +3 = `✗ MISS (9 vs AC 12)`.
  - Press 6 (normal hit): d20 11 +3 = `✓ HIT (14 vs AC 12)` → popup **base formula only** `4d4: 4, 2, 2, 2` = 10 → Bandit `hp_change delta:-10` (11→1). Zero-delta proof: 10 exceeds the 2d4 variant maximum (8), so the pay-out is unambiguously base 4d4. No "half HP" offer chip, no accept/decline controls in popup chrome.
  - Full campaign-log scan (15 entries at the time): all 6 Bites attacks `mode: "normal"`, all 3 damage rolls formulas `4d4` / `4d4*2` (crit) — **`conditional_damage_granted` / `conditional_damage_declined` entries: 0**. Half-HP state inert.
- Note (out of row scope, cosmetic): damage popup pre-hit HP display occasionally stale ("HP: 12 → 0" / "HP: 16 → 0" on an 11-max Bandit); authoritative `hp_change` logs carry correct `maxHp: 11` and deltas.

## Fix
Add the half-HP half-damage variant as `conditional_damage` on swarm-of-spiders Bites in `public/data/monsters.json` (MA-0007 byte-shape, after `damage_type_primary`):

```json
"conditional_damage": { "dice": "2d4", "damage_type": "piercing", "condition": "half HP or fewer" }
```

Expected post-fix: half-HP HIT popup offers `half HP or fewer: +2d4 piercing?`-style accept/decline; accept rolls 2d4 piercing + logs `conditional_damage_granted`; decline logs `conditional_damage_declined` base-only; healthy/miss presses unchanged.
