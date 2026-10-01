# Bug Report — MA-1790: Young Red Dragon lair_actions[1] nameless dict (save+damage) renders inert

## Row (disk, manifest NOT edited)
- `docs/monster-actions-manifest.json` `MA-1790`, stableKey `young-red-dragon|lair_actions|1`
- actionName: `"Unnamed lair actions 2"`, actionType `other`, verified: **not verified**
- Disk (`public/data/monsters.json`, young-red-dragon.lair_actions[1]) is a dict with
  `description`, `save_dc: 15`, `save_type: "Dexterity"`, `damage_dice_primary: "6d6"`,
  `damage_type_primary: "Fire"` — and **NO `name` key**:
  > "Magma erupts from a point on the ground the dragon can see within 120 feet of it, creating a 20-foot-high, 5-foot-radius geyser. Each creature in the geyser's area must make a DC 15 Dexterity saving throw, tak­ ing 21 (6d6) fire damage on a failed save, or half as much damage on a successful one."

## Live probe (test-campaign, 2026-10-01)
- Header verified `test-campaign`; board IN initiative: Young Red Dragon 1 + Bandit 1 (743) + Bandit 2 (861).
- Card via inner `img.avatar-image` → `.mc-overlay`: row 1 renders as static text, **no name prefix, no `DC 15 Dexterity` button, no `6d6` chip** despite fully-authored save + damage fields.
- Click-probe: no save prompt, no refusal popup, no effect.
- Log GET delta: **0** (32 → 32).

## Root cause (inert lane — MV-24 nameless-dict gate)
- `src/services/encounters/monsterLairActions.js:25` — `isLairRowClickable()` early-returns false on `!row.name` **before** checking `save_dc`/damage fields, so this row never becomes clickable even though its mechanic is fully resolvable.
- `src/components/.../MonsterCardBody.jsx:357` — nameless-dict branch renders `la.name ? <strong>…</strong> : null` + static description span.

## Adult-red template cite
Adult red dragon lair_actions[0] carries the identical magma-geyser mechanic WITH `name: "Magma Geyser"` (+ `dc_success: "half"`) → clickable save affordance verified working. Name is the ONLY structural delta.

## Verdict
**INERT-BY-DESIGN (lane gate), data-authoring gap.** All mechanic fields present; only `name` missing. Fix = add `name` (adult template "Magma Geyser") to disk row; no lane-code change. Manifest remains `not verified`; disk wins.
