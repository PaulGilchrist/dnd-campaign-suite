# MA-1558 — Swarm of Insects "Bites" — VERDICT: FAIL(a) / DATA

## Row
```json
{"id":"MA-1558","monster":"Swarm of Insects","monsterIndex":"swarm-of-insects","actionName":"Bites","actionType":"attack","attackBonus":3,"damageDicePrimary":"2d4 + 1","damageTypePrimary":"Poison","reach":"5 ft.","description":"Melee Attack Roll: +3, reach 5 ft. Hit: 6 (2d4 + 1) Poison damage, or 3 (1d4 + 1) Poison damage if the swarm is Bloodied."}
```

## Hypothesis (confirmed)
Swarm bloodied-variant fingerprint lineage (MA-1552/1553/1555/1557): monsters.json Bites carries the Bloodied half-damage clause **prose-only**, no `conditional_damage` field. Live offer pipeline (`MonsterCardHelpers.js:666` `buildChargeBonusOffer` guard `if (!cd?.dice) return null`; `DiceRollResult.jsx` surfaces offers on HIT popups only when the field exists) therefore never arms the 1d4 + 1 variant. Bloodied press pays base with zero delta → FAIL(a)/DATA.

## Static evidence
- `public/data/monsters.json` swarm-of-insects → Bites keys: `name, description, attack_bonus (3), reach ("5 ft."), damage_dice_primary ("2d4 + 1"), damage_type_primary ("Poison")` — **NO `conditional_damage`**. Bloodied clause lives only inside `description` prose ("...or 3 (1d4 + 1) Poison damage if the swarm is Bloodied").
- Guard confirmed live: `src/components/encounter/MonsterCardHelpers.js:664-666` — `const cd = action?.conditional_damage; if (!cd?.dice) return null;` — cd undefined for Bites → offer null forever.
- Whole-library scan (this session): swarm-of-insects not among the ~11 actions carrying `conditional_damage`.

## E2E evidence (localhost:5173, test-campaign, Playwright)
- EB exact "Swarm of Insects" + "Bandit" (Selected Monsters (2)) → Join. Swarm 19/19 AC 11 init 12, Bandit AC 12 max 11. Card via initiative avatar; Target combobox set "Bandit 1" (change-data `combatSummary.creatures[0].targetName = "Bandit 1"`).
- **Step 1 — healthy presses "+3"**:
  - HIT: d20 19 +3 = `✓ HIT (22 vs AC 12)` → HIT popup chrome base-only (Done, no offer chip). Damage popup `2d4 + 1: 3, 2 +1` → **6 Poison applied, hp_change delta −6** (`Bandit 1 11→5`, threshold `bloodied`). Log: roll/attack Bites +3; roll/damage Bites formula `2d4 + 1` total 6 Poison → Bandit 1. Server `_lastRollContext.damageFormula = "2d4 + 1"` Poison.
  - Second healthy HIT: d20 11 +3 = `✓ HIT (15 vs AC 12)` → `2d4 + 1: 2, 2 +1` → **5 applied, −5 exact**. Third healthy HIT: `2d4 + 1: 3, 1 +1` → **−5 exact**.
  - MISS: d20 2 → `✗ MISS (5 vs AC 12)` — clean: no offer chip, no damage popup, no hp_change (miss path clean by design).
  - (One intervening NAT20 crit paid doubled base `2d4+1`→4d4+1 = 9, 11→2; crit path, out of row scope, HP restored after.)
- **Step 2 — GM HP drop to 9/19** (bloodied threshold = floor(19/2) = 9, server change-data confirmed `currentHp=9 maxHp=19`): press d20 14 +3 = `✓ HIT (17 vs AC 12)`. Popup chrome: base formula only, **no offer chip / accept / decline / Bloodied variant chrome anywhere** ("Bloodied" appears solely in the card's description prose). Damage popup `2d4 + 1: 1, 4 +1` → **6 Poison applied, hp_change delta −6** (`Bandit 1 → 0`).
- **Zero-delta proof**: bloodied damage formula identical base `2d4 + 1` (server `_lastRollContext`, log `roll/damage formula "2d4 + 1" total 6 Poison`); full campaign log scan → `conditional_damage_granted` / `conditional_damage_declined` entries: **zero**. MA-1363-style GM-adjudicated offer popup never appears while Bloodied; half-HP state is inert.
- Cosmetic note (not this row's scope): bloodied damage popup rendered "HP: 6 → 0" where hp_change log shows pre-attack currentHp 5; display-label quirk only, delta −6 authoritative.
- Cleanup done: Initiative cleared (confirm accepted; combatSummary players-only, empty init), Admin → Clear Change Data (change-data keys **[]**) + Clear Campaign Log (log entries **0**).

## Fix
Add the Bloodied half-damage variant as `conditional_damage` on swarm-of-insects Bites in `public/data/monsters.json`, MA-0007 byte-shape (dice/damage_type/condition; after `damage_type_primary`, last key):

```json
"conditional_damage": { "dice": "1d4 + 1", "damage_type": "Poison", "condition": "Bloodied" }
```

Expected post-fix behavior (per lineage): bloodied HIT popup offers `Bloodied: +1d4+1 Poison?`; accept rolls 1d4 + 1 Poison and logs `conditional_damage_granted`; decline logs `conditional_damage_declined` base-only; healthy and miss presses unaffected.
