# MA-1557 — Swarm of Dretches "Rend" — VERDICT: FAIL(a) / DATA

## Row
```json
{"id":"MA-1557","monster":"Swarm of Dretches","monsterIndex":"swarm-of-dretches","actionName":"Rend","actionType":"attack","attackBonus":4,"damageDicePrimary":"3d6 + 2","damageTypePrimary":"Slashing","reach":"5 ft.","description":"Melee Attack Roll: +4, reach 5 ft. Hit: 12 (3d6 + 2) Slashing damage, or 9 (3d4 + 2) Slashing damage if the swarm is Bloodied."}
```

## Hypothesis (confirmed)
Swarm bloodied-variant fingerprint lineage (MA-1552/1553/1555): monsters.json Rend has the Bloodied half-damage clause **prose-only**, no `conditional_damage` field. Live offer pipeline (`MonsterCardHelpers.js:665` `buildChargeBonusOffer` reads `action?.conditional_damage` only; `DiceRollResult.jsx:836` surfaces offers on HIT popups only when the field exists) therefore never offers the 3d4 + 2 variant. Bloodied press pays base with zero delta → FAIL(a)/DATA.

## Static evidence
- `public/data/monsters.json` swarm-of-dretches → Rend keys: `name, description, attack_bonus, reach, damage_dice_primary ("3d6 + 2"), damage_type_primary ("Slashing")` — **NO `conditional_damage`**.
- Whole-library scan: only 11 actions carry `conditional_damage` (Aarakocra Skirmisher, Chimera, Galeb Duhr, Quaggoth, Mimic, Ram/Gore family, etc.); swarm-of-dretches is not among them.

## E2E evidence (localhost:5173, test-campaign, Playwright)
- EB exact "Swarm of Dretches" + "Bandit" → Join. Swarm 45/45 (init 5), Bandit AC 12.
- **Step 1 — healthy press "+4"**: attack d20 19+4 = 23 → `✓ HIT (23 vs AC 12)`; HIT popup shows only Done — no offer chip. Done → damage popup `3d6 + 2: 5, 5, 5 +2` → **17 Slashing applied, hp_change delta −17** (base exact live). Log: roll/attack Rend total 19 bonus 4; roll/damage Rend formula `3d6 + 2` total 17 Slashing → Bandit 1; hp_change −17.
- **Miss capture**: bloodied presses rolled d20 4 → `✗ MISS (8 vs AC 12)` and d20 6 → `✗ MISS (10 vs AC 12)` — misses never offer (by design), confirming miss path clean.
- **Step 2 — GM HP drop to 22/45** (bloodied threshold = floor(45/2) = 22, server change-data confirmed `hp= 22 max= 45`): third press d20 11+4 = 15 → `✓ HIT (15 vs AC 12)`. Popup chrome: base formula only, **no offer chip / accept / decline / Bloodied variant chrome anywhere**. Damage popup: `3d6 + 2: 3, 5, 5 +2` → **15 Slashing applied, hp_change delta −15**.
- **Zero-delta**: full campaign log scan → `conditional_damage_granted` / `conditional_damage_declined` entries: **[] (zero)**. MA-1363-style GM-adjudicated offer popup never appears while bloodied; half-HP state is inert.
- Cleanup done: Initiative cleared, Admin → Clear Change Data (change-data keys 0) + Clear Campaign Log (log entries 0).

## Fix
Add the Bloodied half-damage variant as `conditional_damage` on swarm-of-dretches Rend in `public/data/monsters.json`, MA-0007 byte-shape (dice/damage_type/condition; after `damage_type_primary`, last key):

```json
"conditional_damage": { "dice": "3d4 + 2", "damage_type": "Slashing", "condition": "Bloodied" }
```

Expected post-fix behavior (per lineage): bloodied HIT popup offers 3d4 + 2; accept rolls 3d4 + 2 Slashing and logs `conditional_damage_granted`; decline logs `conditional_damage_declined` base-only; healthy and miss presses unaffected.
