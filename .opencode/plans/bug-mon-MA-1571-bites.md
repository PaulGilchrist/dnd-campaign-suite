# MA-1571 — Swarm of Wasps "Bites": missing conditional_damage (FAIL / DATA)

## Verdict

**FAIL — DATA.** The manifest row authors no `conditional_damage`, so the halved-swarm
damage clause ("5 (2d4) piercing damage if the swarm has half of its hit points or fewer")
is silently dropped. Exact byte-twin of MA-1568 swarm-of-spiders FAIL(a)/DATA.

## Row under test

```json
{"id":"MA-1571","monster":"Swarm of Wasps","monsterIndex":"swarm-of-wasps","actionName":"Bites","actionType":"attack","attackBonus":3,"damageDicePrimary":"4d4","damageTypePrimary":"piercing","reach":"0 ft.","description":"Melee Weapon Attack: +3 to hit, reach 0 ft., one target in the swarm's space. Hit: 10 (4d4) piercing damage, or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer."}
```

## Static pre-probe confirmation (public/data/monsters.json)

- `swarm-of-wasps` → actions[0] `Bites`: keys = `name, description, attack_bonus, reach,
  damage_dice_primary (4d4), damage_type_primary (piercing)`. **No `conditional_damage`.**
- Byte-twin verified vs `swarm-of-spiders` Bites (MA-1568): identical field set and values
  (+3 / 4d4 / piercing / same description clause). Both rows omit the half-HP 2d4 clause.

## E2E evidence (Playwright, localhost:5173, test-campaign, Bandit AC 12)

### Probe 1 — healthy swarm (HP 22/22) — PASS behavior
- Press "+3": miss — `d20 5 +3 = 8 vs AC 12` → "MISS (8 vs AC 12)" ✓ (≤8 miss confirmed)
- Press "+3": hit — `d20 11 +3 = 14 vs AC 12`; damage popup **4d4: 3,2,2,4 = 11**;
  log: `rollType:"damage", formula:"4d4", damageType:"piercing", finalDamage:11,
  targetName:"Bandit 1"` ✓ base-only exact when healthy.

### Probe 2 — swarm at half HP (11/22, ≤ half) — FAIL confirmation
- HP set to 11/22 (server-verified `currentHp:11, maxHp:22`; modal showed "11 (5d8)").
- Press "+3": hit — `d20 16 +3 = 19 vs AC 12`.
- Damage popup: **base-only "4d4: 2, 4, 2, 2" = 10** applied to Bandit 1 (HP 11 → 1).
  Rules require **2d4 (avg 5)** at half HP or fewer → **zero delta**, halving never applied.
- **No offer chrome**: hit popup contained only d20 + Advantage/Disadvantage + Done;
  no conditional-damage offer UI surfaced.
- **Log conditional = 0**: campaign log `conditional` entries count = 0
  (no `conditional_damage_granted` / `conditional_damage_declined` / offer events).
  Half-HP damage log identical byte-shape to healthy log: `formula:"4d4",
  damageType:"piercing", finalDamage:10`.

## Fix

Add `conditional_damage` to `public/data/monsters.json` → `swarm-of-wasps` →
actions[0] `Bites`, mirroring the MA-0007 conditional_damage mechanism (offered on HIT only):

```json
"conditional_damage": {
  "dice": "2d4",
  "damage_type": "piercing",
  "condition": "half HP or fewer"
}
```

Apply the identical fix to the byte-twin sibling `swarm-of-spiders` (MA-1568) in the same
data pass so both swarm rows stop silently dropping their halved-swarm clause.

## Cleanup performed

- Initiative cleared (confirm accepted).
- Admin → Clear Change Data (test-campaign) → verified `change-data keys: []`.
- Admin → Clear Campaign Log (test-campaign) → verified `log entries: 0`.
- No other campaign touched.
