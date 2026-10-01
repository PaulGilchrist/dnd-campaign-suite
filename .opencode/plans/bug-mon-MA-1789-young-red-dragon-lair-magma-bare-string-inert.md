# Bug Report — MA-1789: Young Red Dragon lair_actions[0] bare string renders inert

## Row (disk, manifest NOT edited)
- `docs/monster-actions-manifest.json` `MA-1789`, stableKey `young-red-dragon|lair_actions|0`
- actionName: `"Unnamed lair actions 1"`, actionType `other`, verified: **not verified**
- Disk (`public/data/monsters.json`, young-red-dragon.lair_actions[0]) is a **bare string**:
  > "Magma erupts from a point on the ground the dragon can see within 120 feet of it, creating a 20-foot-high, 5-foot-radius geyser. Each creature in the geyser's area must make a DC 15 Dexterity saving throw, tak­ ing 21 (6d6) fire damage on a failed save, or half as much damage on a successful one."

## Live probe (test-campaign, 2026-10-01)
- Header verified `test-campaign`; board IN initiative: Young Red Dragon 1 (init 23) + Bandit 1 (HP 743 inert twin) + Bandit 2 (HP 861 inert twin).
- Opened card via inner `img.avatar-image` → `.mc-overlay`; Lair Actions section renders row 0 as a **static `<div class="mc-action">` span** — no button, no name, no DC chip, no damage chip.
- Click-probe: no save prompt, no refusal popup, no effect.
- Log GET delta: **0** (32 → 32 entries).

## Root cause (inert lane by design, MA-0024 / MV-24)
- `src/services/encounters/monsterLairActions.js:25` — `isLairRowClickable()` returns false for non-objects (`typeof row !== 'object' || !row.name`), so legacy plain-string rows never become clickable (~600-monster regression protection).
- `src/components/.../MonsterCardBody.jsx:357` — `MonsterLairAction` short-circuits `typeof la === 'string'` to the static `dangerouslySetInnerHTML` render.

## Adult-red template cite (named-fix template)
Adult red dragon lair_actions[0] on disk is a structured, **named** dict: `name: "Magma Geyser"`, `save_dc: 15`, `save_type: "Dexterity"`, `damage_dice_primary: "6d6"`, `damage_type_primary: "Fire"`, `dc_success: "half"` → passes `isLairRowClickable` (name + save_dc) and routes through the gated save affordance.

## Verdict
**INERT-BY-DESIGN (no defect).** Bare-string row cannot arm any affordance. Fix (if ever desired) = data authoring mirroring the adult template (name + save_dc/save_type + damage fields), not lane code. Manifest row remains `not verified`; disk wins; no code change made.
