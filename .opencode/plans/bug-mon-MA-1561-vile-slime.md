# MA-1561 — Swarm of Lemures "Vile Slime" — VERDICT: FAIL(a) / DATA

## Row
```json
{"id":"MA-1561","monster":"Swarm of Lemures","monsterIndex":"swarm-of-lemures","actionName":"Vile Slime","actionType":"attack","attackBonus":4,"damageDicePrimary":"2d8 + 2","damageTypePrimary":"Poison","reach":"5 ft.","description":"Melee Attack Roll: +4, reach 5 ft. Hit: 11 (2d8 + 2) Poison damage, or 9 (2d6 + 2) Poison damage if the swarm is Bloodied."}
```

## Hypothesis (confirmed)
Swarm bloodied-variant fingerprint lineage (MA-1552/1553/1555/1557/1558/1559): monsters.json Vile Slime carries the Bloodied half-damage clause **prose-only**, no `conditional_damage` field. Live offer pipeline (`src/components/encounter/MonsterCardHelpers.js` `buildChargeBonusOffer` guard `const cd = action?.conditional_damage; if (!cd?.dice) return null;`) therefore never arms the `2d6 + 2` variant. Bloodied press pays base `2d8 + 2` with zero offer → FAIL(a)/DATA.

## Static evidence
- `public/data/monsters.json` swarm-of-lemures → Vile Slime keys: `name, description, attack_bonus (4), reach ("5 ft."), damage_dice_primary ("2d8 + 2"), damage_type_primary ("Poison")` — **NO `conditional_damage`**. Bloodied clause lives only inside `description` prose ("...or 9 (2d6 + 2) Poison damage if the swarm is Bloodied").

## E2E evidence (localhost:5173, test-campaign, Playwright)
- Campaign header verified `test-campaign` after select. EB exact "Swarm of Lemures" + "Bandit" (both qty 1) → Join. Swarm of Lemures 1: 45/45 AC 12 init 17; Bandit 1: 11/11 AC 12 init 10 (change-data confirmed). Card via initiative avatar; tracker Target combobox set "Bandit 1" (`combatSummary.creatures → Swarm.targetName = "Bandit 1"`).
- **Step 1 — healthy presses "+4"** (swarm 45/45):
  - **MISS**: d20 7 → `✗ MISS (11 vs AC 12)` — clean, no damage popup.
  - **HIT**: d20 18 → `✓ HIT (22 vs AC 12)` → damage popup **base `2d8 + 2: 5, 4 +2`** → **11 applied to Bandit (HP 11 → 0, isUnconscious)**. `lastAttack`: `damageFormula "2d8 + 2"`, `damageType Poison`, `rawDamage/primaryDamage/actualDamage 11`, `rolls [5,4]`, `secondaryFormula None`, **no `conditional_damage` key**. Popup chrome base-formula only, no offer chip. (HP raised to 99/99 attempt did not persist through GM inline spinbutton — combatSummary authoritative at 11/11; bandit died at exactly rolled 11, full base roll, delta −11 not capped.)
- **Step 2 — GM HP drop to swarm 22/45** (bloodied threshold = half = 22.5, so 22 → Bloodied; change-data confirmed `currentHp=22 maxHp=45`; card header reads "22 (6d10 + 12)"). Bandit revived to 11/11 via keyboard-enter commit.
  - Bloodied card Vile Slime line: single "+4" button + prose only — **no Bloodied offer chip / accept / decline** ("Bloodied" appears solely in description prose).
  - Bloodied **MISS**: d20 6 → `✗ MISS (10 vs AC 12)` — no Bloodied chrome.
  - Bloodied **HIT**: d20 11 → `✓ HIT (15 vs AC 12)` → damage popup **base `2d8 + 2: 3, 1 +2`** → **6 applied to Bandit (HP 11 → 5, delta −6)**. `lastAttack`: `damageFormula "2d8 + 2"`, `actualDamage 6`, `rolls [3,1]`, `secondaryFormula None`, **no `conditional_damage`**. Offered-but-never-armed `2d6 + 2` variant absent.
- **Zero-delta proof**: full-session log scan (11 entries): `conditional_damage_granted` = **0**, `conditional_damage_declined` = **0**. Both damage rolls formula `2d8 + 2` Poison (healthy rolls [5,4]=11 → hp_change −11; bloodied rolls [3,1]=6 → hp_change −6); **any `2d6` formula: zero**. Only "bloodied" ref is the target's hp_change `threshold:"bloodied"` — the swarm's own Bloodied state is fully inert for damage.
- Cleanup done: Admin → Clear Change Data (change-data keys **[]**) + Clear Campaign Log (log entries **0**); Initiative → Clear (confirm accepted; combatSummary reset to player placeholders round 1, no Swarm/Bandit).

## Fix
Add the Bloodied half-damage variant as `conditional_damage` on swarm-of-lemures Vile Slime in `public/data/monsters.json`, MA-0007 byte-shape (dice/damage_type/condition; after `damage_type_primary`, last key):

```json
"conditional_damage": { "dice": "2d6 + 2", "damage_type": "Poison", "condition": "Bloodied" }
```

Expected post-fix behavior (per lineage): bloodied HIT popup offers `Bloodied: +2d6+2 Poison?`; accept rolls `2d6 + 2` Poison and logs `conditional_damage_granted`; decline logs `conditional_damage_declined` base-only; healthy and miss presses unaffected.
