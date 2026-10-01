# MA-1784 — Young Green Dragon lair_actions[1]: nameless dict with save_dc, inert at name gate

## Disk quote (public/data/monsters.json → young green dragon → lair_actions[1])

```json
{
  "description": "Grasping roots and vines erupt in a 20-foot radius centered on a point on the ground that the dragon can see within 120 feet of it. That area becomes difficult terrain, and each creature there must succeed on a DC 15 Strength saving throw or be restrained by the roots and vines. A creature can be freed if it or another creature takes an action to make a DC 15 Strength check and succeeds. The roots and vines wilt away when the dragon uses this lair action again or when the dragon dies.",
  "save_dc": 15,
  "save_type": "Strength"
}
```

Dict with `save_dc:15`, `save_type:"Strength"` — **no `name`**.

## Gate evidence

- `src/services/encounters/monsterLairActions.js:25` — `isLairRowClickable`: `if (!row || typeof row !== 'object' || !row.name) return false;` — the gate checks `name` BEFORE any save_dc/attack_bonus/zone/damage inspection. The fully-usable `save_dc:15 / Strength` keys are unreachable: no nameless-row rescue exists.
- `src/components/MonsterCard/MonsterCardBody.jsx:357` — not clickable → static render path; the `name ? <strong>{la.name}</strong>` branch prints nothing, description renders as plain prose.
- `lairRowAffordance()` would return `'save'` if the row got past the name gate — the only defect is the missing `name`.

## Live probe (test-campaign, initiative round 1)

Same session as MA-1783. Overlay `.mc-overlay`; lair row inventory: rows 4/5/6 all `mc-action`, `hasButton:false`, `hasStrongName:false`. Click-probe on this row (5): no save prompt at DC 15 Strength, no refusal popup, no zone picker. Log GET before 26 / after 26, zero lair/roots/thorn entries. **Delta = 0.**

## Verdict

INERT confirmed. Mechanically complete save row rejected solely by the `!row.name` gate at monsterLairActions.js:25.

## Fix template (adult green dragon)

`adult green dragon.lair_actions[0]` = `{name:"Grasping Roots", description, save_dc:15, save_type:"Strength", dc_success:"none", save_effect:"The target is restrained by the roots and vines."}` — add `name` (and optionally `dc_success`/`save_effect`) and the row becomes a clickable DC 15 Strength save affordance. Restrained-clause application rides the MA-0017 damageless-condition seam; difficult-terrain radius stays GM-enforced advisory (§70 grep-zero for a terrain/zone consumer).
