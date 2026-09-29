# Bug: MA-1563 Swarm of Poisonous Snakes — Bites save half deals wrong dice/type

**Verdict: FAIL** (save half wrong; attack half exact)

## Row (MA-1563)
- Monster: Swarm of Poisonous Snakes (`swarm-of-poisonous-snakes`), action "Bites", type `attack+save`
- Authored (confirmed in `public/data/monsters.json`):
  - attack_bonus 6, damage `2d6` piercing, reach 0 ft.
  - save_dc 10, save_type Constitution, save_effect `"14 (4d6) Poison damage. Success: Half damage."`
  - No `conditional_damage` → bloodied 1d6 variant prose-only → inert (twin lineage MA-1552..1562)

## Environment
- localhost:5173 (npm run dev), campaign `test-campaign` ONLY
- EB: exact "Swarm of Poisonous Snakes" + exact "Bandit" → Join Encounter
- Target select on swarm row = Bandit 1 (AC 12); Bandit HP raised (currentHp 40 via tracker)
- Swarmed card shows twin chips as expected: `+6`, `2d6`, `DC 10 Constitution`

## ATTACK half — PASS (exact)
- Press `+6` chip:
  - nat 20 → crit, dialog "2d6: 5*2, 2*2 +0" (doubled), 14 applied HP 40→26 ✓
  - nat 5 → "MISS (11 vs AC 12)" ✓ (miss threshold: nat ≤5 only)
  - nat 1 → "Critical Miss! ✗ MISS (7 vs AC 12)" ✓
  - nat 14 → HIT 20 vs AC 12, "2d6: 5, 6" = 11, HP 26→15 ✓ exact 2d6 piercing
  - Bloodied probe (swarm currentHp 18 = half max): nat 16 HIT, "2d6: 5, 4" = 9 applied — still 2d6, NOT conditional 1d6 → inert variant behaves as documented ✓
- All attack dice = damage_dice_primary 2d6, type piercing. Correct.

## SAVE half — FAIL (wrong dice + wrong type)
Pressing `DC 10 Constitution` chip auto-rolls: CON save d20 vs DC 10 is computed correctly (Bandit CON +0; success on d20 ≥ 10, e.g. 10→"✓ SAVE SUCCESS (10 vs DC 10)", 3/8/9 → failure — floor-half applied on success ✓). BUT the damage payload rolls the **attack primary dice 2d6 piercing**, never the save_effect **4d6 poison**:

| # | d20+0 | Result | Dialog dice | Raw | Applied | Expected |
|---|-------|--------|-------------|-----|---------|----------|
| 1 | 10+0=10 | SUCCESS | 2d6: 3, 5 | 8 | 4 (HP 40→36) | 4d6 → half |
| 2 | 3+0=3 | FAILURE | 2d6: 1, 2 | 3 | 3 (HP 36→33) | 4d6 full (min 4) |
| 3 | 8+0=8 | FAILURE | 2d6: 1, 6 | 7 | 7 (HP 33→26) | 4d6 full |
| 4 | 14+0=14 | SUCCESS | 2d6: 6, 2 | 8 | 4 (HP 26→22) | 4d6 → half |
| 5 | 18+0=18 | SUCCESS | 2d6: 4, 4 | 8 | 4 (HP 22→18) | 4d6 → half |
| 6 | 9+0=9 | FAILURE | 2d6: 4, 1 | 5 | 5 (HP 18→13) | 4d6 full |

Decisive proof — campaign log entries for every save press (3 observed failures, e.g.):
```json
{"characterName":"Swarm of Poisonous Snakes 1","rollType":"save-damage","name":"Bites",
 "formula":"2d6","rolls":[1,2],"total":3,"damageType":"piercing","targetName":"Bandit 1"}
```
- `formula` is always `"2d6"` (never `4d6`), `damageType` always `"piercing"` (never poison).
- Failure roll of 2d6:1+2=3 is mathematically impossible for 4d6 (min 4) → wrong dice pool confirmed.
- `lastAttack` server record after save press: `rollType:"save"`, `saveResult:"failure"`, `rawDamage:3`, `primaryDamageType:"piercing"`, `isSpellDamage:true`.
- Half-on-success mechanic itself works (floor 8→4, 8→4) and HP deltas are exact for the rolled dice — only the dice pool and damage type sourced from the row are wrong. The DC/type/save resolution is correct.

## Compounding / independence observation
Both chips resolved independently with separate HP drops and separate log entries (attack rolls + save-damage entries) — independent correctness observed.

## Notes
- Bloodied 1d6 variant is inert by design (prose-only, no conditional_damage on row) — registry note only, not a bug.
- Side observations (not the graded halves): tracker maxHp edits via the initiative spinbox did not sync to server (stayed maxHp 11 while UI showed 40; currentHp synced fine), tracker current-HP spinbox display lagged after damage applied (server had correct value), and one unexplained +2 HP bump on Bandit between two dialogs (7→9) — likely leftover campaign automation; noted, not graded.

## Cleanup performed
- Initiative cleared (confirm accepted)
- Admin → Clear Change Data (test-campaign change-data now `{}`)
- Admin → Clear Campaign Log (log now 0 entries)
