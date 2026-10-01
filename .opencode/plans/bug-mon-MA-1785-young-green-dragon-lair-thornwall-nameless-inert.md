# MA-1785 — Young Green Dragon lair_actions[2]: nameless thorn-wall dict with save + damage keys, inert at name gate

## Disk quote (public/data/monsters.json → young green dragon → lair_actions[2])

```json
{
  "description": "A wall of tangled brush bristling with thorns springs into existence on a solid surface within 120 feet of the dragon. The wall is up to 60 feet long, 10 feet high, and 5 feet thick, and it blocks line of sight. When the wall appears, each creature in its area must make a DC 15 Dexterity saving throw. A creature that fails the save takes 18 (4d8) piercing damage and is pushed 5 feet out of the wall's space, appearing on whichever side of the wall it wants. A creature can move through the wall, albeit slowly and painfully. For every 1 foot a creature travels through the wall, it must spend 4 feet of movement. Furthermore, a creature in the wall's space must make a DC 15 Dexterity saving throw once each round it's in contact with the wall, taking 18 (4d8) piercing damage on a failed save, or half as much damage on a successful one. Each 10-foot section of wall has AC 5, 15 hit points, vulnerability to fire damage, resistance to bludgeoning and piercing damage, and immunity to psychic damage. The wall sinks back into the ground when the dragon uses this lair action again or when the dragon dies.",
  "save_dc": 15,
  "save_type": "Dexterity",
  "damage_dice_primary": "4d8",
  "damage_type_primary": "Piercing"
}
```

Dict with `save_dc:15`, `save_type:"Dexterity"`, `damage_dice_primary:"4d8"`, `damage_type_primary:"Piercing"` — **no `name`**.

## Gate evidence

- `src/services/encounters/monsterLairActions.js:25` — `isLairRowClickable`: `!row.name → false`. Both the save leg and the damage leg (`damage_dice_primary && canRollExpression(...)` would pass `4d8`) are stranded behind the name gate — no rescue.
- `src/components/MonsterCard/MonsterCardBody.jsx:357` — static render; no affordance, no label chip.
- Clause residuals (§70, grep-zero advisory as expected): line-of-sight blocking, 4-ft-per-1-ft movement cost through the wall, per-round contact re-save, and wall-section AC/HP object stats have no engine consumers (`rg` for a Wall-of-Thorns/terrain/damage-zone consumer → advisory targetEffect descriptions only, all marked "GM-enforced").

## Live probe (test-campaign, initiative round 1)

Same session. `.mc-overlay` lair row inventory: rows 4/5/6 static `mc-action`, `hasButton:false`, `hasStrongName:false`. Click-probe on this row (6): no save prompt at DC 15 Dex, no damage chip roll, no refusal popup. Log GET before 26 / after 26; zero lair/roots/thorn entries. **Delta = 0.**

## Verdict

INERT confirmed. Richest of the three rows (save + damage keys authored) still inert purely for the missing `name`.

## Fix template (adult green dragon)

`adult green dragon.lair_actions[1]` = `{name:"Wall of Thorns", ...}` — the adult's structured named row is the template: add `name:"Wall of Thorns"` and the save/damage keys route through the gated affordance (`lairRowAffordance` → `'save'` at DC 15 Dex with 4d8 Piercing damage chip, half-on-success math via MV-20/MV-27). Movement-cost, LoS-block, and wall-object clauses stay GM-enforced advisory (§70).
