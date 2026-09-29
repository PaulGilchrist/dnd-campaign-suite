# MA-1559 — Swarm of Larvae "Bites" — VERDICT: FAIL(a) / DATA

## Row
```json
{"id":"MA-1559","monster":"Swarm of Larvae","monsterIndex":"swarm-of-larvae","actionName":"Bites","actionType":"attack","attackBonus":4,"damageDicePrimary":"2d6 + 2","damageTypePrimary":"Necrotic","reach":"5 ft.","description":"Melee Attack Roll: +4, reach 5 ft. Hit: 9 (2d6 + 2) Necrotic damage, or 7 (2d4 + 2) Necrotic damage if the swarm is Bloodied."}
```

## Hypothesis (confirmed)
Swarm bloodied-variant fingerprint lineage (MA-1552/1553/1555/1557/1558): monsters.json Bites carries the Bloodied half-damage clause **prose-only**, no `conditional_damage` field. Live offer pipeline (`src/components/encounter/MonsterCardHelpers.js:665-666` `buildChargeBonusOffer` guard `const cd = action?.conditional_damage; if (!cd?.dice) return null;`) therefore never arms the 2d4 + 2 variant. Bloodied press pays base 2d6 + 2 with zero delta → FAIL(a)/DATA.

## Static evidence
- `public/data/monsters.json` swarm-of-larvae → Bites keys: `name, description, attack_bonus (4), reach ("5 ft."), damage_dice_primary ("2d6 + 2"), damage_type_primary ("Necrotic")` — **NO `conditional_damage`**. Bloodied clause lives only inside `description` prose ("...or 7 (2d4 + 2) Necrotic damage if the swarm is Bloodied").
- Guard confirmed live: `MonsterCardHelpers.js:665-666` — cd undefined for Bites → offer null forever.

## E2E evidence (localhost:5173, test-campaign, Playwright)
- EB exact "Swarm of Larvae" + "Bandit" (both qty 1) → Join. Swarm of Larvae 1: 22/22 AC 13 init 13; Bandit 1: 11/11 AC 12 init 13 (change-data confirmed). Card via initiative avatar (first click absorbed §138); tracker Target combobox set "Bandit 1" (`combatSummary.creatures → Swarm.targetName = "Bandit 1"`).
- **Step 1 — healthy presses "+4"** (all HITs pay exact base 2d6 + 2 Necrotic):
  - d20 11 → `✓ HIT (15 vs AC 12)` → popup `2d6 + 2: 3, 6 +2` → **11 applied, hp_change delta −11** (Bandit 11→0, `isUnconscious`). Log roll/damage formula `2d6 + 2` total 11 Necrotic.
  - d20 10 → HIT → `2d6 + 2: 5, 5 +2` → **−12 exact**. d20 11 → HIT → `1, 1 +2` → **−4 exact**. d20 9 → HIT → `2, 4 +2` → **−8 exact**. d20 12 → HIT → `2, 5 +2` → **−9** (11→2). d20 14 → HIT → `4, 3 +2` → **−9**. d20 9 → HIT → `3, 2 +2` → **−7**. d20 14 → HIT → `1, 4 +2` → **−7**. d20 10 → HIT → `6, 3 +2` → **−11**.
  - Every healthy HIT popup chrome: base formula only, no offer chip. Between presses Bandit revived to 11 via GM change-data POST.
  - **MISS**: d20 3 → `✗ MISS (7 vs AC 12)` (total 7 ≤ d20≤7 reachable) — clean: no damage popup, no hp_change, bandit stays 11.
- **Step 2 — GM HP drop to 11/22** (bloodied threshold = floor(22/2) = 11, change-data confirmed `currentHp=11 maxHp=22`):
  - Bloodied HIT: d20 13 → `✓ HIT (17 vs AC 12)`. Attack + damage popup chrome: **base formula `2d6 + 2` only — no offer chip / accept / decline / Bloodied variant anywhere** ("Bloodied" appears solely in the card's description prose). Damage popup `2d6 + 2: 1, 6 +2` → **9 Necrotic applied, hp_change delta −9** (11→2). Offered-but-never-armed 2d4 + 2 variant absent.
  - Bloodied HIT #2 (corroboration): d20 9 → `✓ HIT (13 vs AC 12)` → `2d6 + 2: 1, 6 +2` → **−9 exact, base-only again**.
  - Intervening bloodied misses (d20 6 → `✗ MISS (10 vs AC 12)`; nat1 → `✗ MISS (5)`) and one nat20 crit (`2d6*2+2` doubled-base, crit path out of row scope) offered no Bloodied chrome either.
- **Zero-delta proof**: full-session log scan (42 entries): `conditional_damage_granted` = **0**, `conditional_damage_declined` = **0**, "Bloodied" refs = 0. All 12 damage rolls formula `2d6 + 2` Necrotic (plus 1 crit `2d6*2+2`); **any 2d4 roll: zero**. Bloodied state fully inert.
- Cosmetic note (not this row's scope): damage popup pre-hit HP label occasionally reads +1 over hp_change authoritative currentHp (e.g. "HP: 12 → 0" where log shows 11→0, delta −12 authoritative) — same display-label quirk as MA-1558 lineage.
- Cleanup done: Initiative cleared (confirm accepted; combatSummary NPCs reset to placeholders NPC 1/NPC 2, players retained), Admin → Clear Change Data (change-data keys **[]**) + Clear Campaign Log (log entries **0**).

## Fix
Add the Bloodied half-damage variant as `conditional_damage` on swarm-of-larvae Bites in `public/data/monsters.json`, MA-0007 byte-shape (dice/damage_type/condition; after `damage_type_primary`, last key):

```json
"conditional_damage": { "dice": "2d4 + 2", "damage_type": "Necrotic", "condition": "Bloodied" }
```

Expected post-fix behavior (per lineage): bloodied HIT popup offers `Bloodied: +2d4+2 Necrotic?`; accept rolls 2d4 + 2 Necrotic and logs `conditional_damage_granted`; decline logs `conditional_damage_declined` base-only; healthy and miss presses unaffected.
