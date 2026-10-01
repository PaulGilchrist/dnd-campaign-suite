# Bug Report — MA-1791: Young Red Dragon lair_actions[2] nameless dict (DC 15 Dex / prone) renders inert

## Row (disk, manifest NOT edited)
- `docs/monster-actions-manifest.json` `MA-1791`, stableKey `young-red-dragon|lair_actions|2`
- actionName: `"Unnamed lair actions 3"`, actionType `other`, conditions: `["prone"]`, verified: **not verified**
- Disk (`public/data/monsters.json`, young-red-dragon.lair_actions[2]) is a dict with
  `description`, `save_dc: 15`, `save_type: "Dexterity"` — **NO `name`, no damage fields**:
  > "A tremor shakes the lair in a 60-foot radius around the dragon. Each creature other than the dragon on the ground in that area must succeed on a DC 15 Dexterity saving throw or be knocked prone."

## Live probe (test-campaign, 2026-10-01)
- Header verified `test-campaign`; board IN initiative: Young Red Dragon 1 + Bandit 1 (743) + Bandit 2 (861).
- Card via inner `img.avatar-image` → `.mc-overlay`: row 2 renders as static text — no name, no `DC 15 Dexterity` chip.
- Click-probe: no save prompt, no refusal popup, no effect; no prone applied to Bandit 1/2 (HP/init unchanged, no condition badges).
- Log GET delta: **0** (32 → 32).

## Root cause (inert lane — MV-24 nameless-dict gate)
- `src/services/encounters/monsterLairActions.js:25` — `isLairRowClickable()` requires `row.name`; nameless row fails the gate even though `save_dc != null` would otherwise make it a `save` affordance (`lairRowAffordance`, same file).
- `src/components/.../MonsterCardBody.jsx:357` — static nameless-dict render.

## Adult-red template cite
Adult red dragon lair_actions[1] is the same tremor mechanic, named: `name: "Tremor"`, `save_dc: 15`, `save_type: "Dexterity"`, `dc_success: "none"`, `save_effect: "Failure: The target is knocked prone…"` → clickable save row; damageless failed-save condition applies via the MA-0017 prone seam (grasping-tide precedent, per lane header comment). Manifest `conditions:["prone"]` label matches this template outcome.

## Verdict
**INERT-BY-DESIGN (lane gate), data-authoring gap.** Only `name` (adult template "Tremor") missing; prone-on-fail is fully supported by the save seam once named. No code change; manifest stays `not verified`; disk wins.
