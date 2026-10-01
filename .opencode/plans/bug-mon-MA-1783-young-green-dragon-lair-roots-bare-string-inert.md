# MA-1783 — Young Green Dragon lair_actions[0]: bare-string lair row, inert

## Disk quote (public/data/monsters.json → young green dragon → lair_actions[0])

Bare string (not a dict):

> "Grasping roots and vines erupt in a 20-foot radius centered on a point on the ground that the dragon can see within 120 feet of it. That area becomes difficult terrain, and each creature there must succeed on a DC 15 Strength saving throw or be restrained by the roots and vines. A creature can be freed if it or another creature takes an action to make a DC 15 Strength check and succeeds. The roots and vines wilt away when the dragon uses this lair action again or when the dragon dies."

## Gate evidence

- `src/components/MonsterCard/MonsterCardBody.jsx:357` — `MonsterLairAction`: `if (typeof la === 'string' || !isLairRowClickable(la))` → static `<div className="mc-action">` render. A bare string never reaches the clickable affordance branch.
- `src/services/encounters/monsterLairActions.js:25` — `isLairRowClickable`: `if (!row || typeof row !== 'object' || !row.name) return false;` — a string fails the typeof-object test outright; save_dc/damage keys cannot rescue (no rescue path exists for bare strings, per MA-0024 ~600-monster regression protection).
- The embedded mechanic (DC 15 Strength save → restrained, 20-ft difficult-terrain radius) is prose-locked inside the string: no `save_dc`, `save_type`, or `zone` keys to parse.

## Live probe (test-campaign, initiative round 1)

Board: Young Green Dragon 1 (init 17, HP 136/136) + Bandit 1 (851) + Bandit 2 (938). Header verified `test-campaign`.

- Overlay via `img.avatar-image` → `.mc-overlay` opened.
- Inventory: 3 lair rows rendered (overlay rows 4/5/6), all plain `mc-action` divs — `hasButton:false`, `hasStrongName:false`.
- Click-probe row: no save prompt, no refusal popup, no zone picker, overlay unchanged.
- Log GET before: 26 entries, 0 lair/roots/thorn. Log GET after: 26 entries, 0 lair/roots/thorn. **Delta = 0.**

## Verdict

INERT confirmed. Bare-string lair row renders statically; zero adjudication surface.

## Fix template (adult green dragon)

`adult green dragon.lair_actions[0]` is a structured dict: `{name:"Grasping Roots", description, save_dc:15, save_type:"Strength", dc_success:"none", save_effect:"The target is restrained by the roots and vines."}` — same roots prose, converted to a clickable save row with GM-enforced caveats appended to description. Difficult-terrain radius remains advisory (§70 grep-zero: no movement-cost/zone consumer for this mechanic; only `ignore_difficult_terrain_on_dash` passives and GM-enforced advisory targetEffect entries exist).
