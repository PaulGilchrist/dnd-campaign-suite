# BUG MA-0285 — Animated Object (Large) · Slam · VERDICT: FAIL

**Fingerprint:** MA-0284 formula-row inert (identical shape, confirmed).

## Row (curl GET /data/monsters.json)
- `index: animated-object-large`, actions[0] "Slam", `attack_bonus: null`, `damage_dice_primary: "2d6+3+spellcasting modifier"` (force), reach "5 ft."
- description: "Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 2d6+3+spellcasting modifier Force damage."
- All mods/proficiency_bonus/spellcasting_ability authored `null` — caster-dependent 2024 row.

## Evidence
- DOM: `div.mc-action ` (trailing space, no interactive class) containing only `<strong>Slam.</strong><span>…</span>` — no `mc-dice-link` bonus chip, no damage chip. `__reactProps.onClick` = `undefined` on row, strong, and span → structurally dead (MonsterAction.jsx:163 `attack_bonus != null` chip gate + ActionDamageLinks `canRollExpression` fails prose formula; MA-0014 suppression).
- 2 trusted clicks (strong + span) → zero overlays, zero log delta.
- Control (same card): STR chip `+3` rolled live — popup "d20 13 +3 (+3 to hit)" + log `roll/STR total 13`. Engine wiring healthy; row-specific gates dead.
- curl log (watermark ts>1789541660855): only `encounter`, `roll/Initiative`, `roll/STR`×2 — no `ability_use`/`hp_change`/`roll/Slam`. Druid (armed target) change-data key md5 identical, HP 137→137.

## Root cause
DATA expression authoring: null `attack_bonus` + unparseable "…+spellcasting modifier" prose formula fails both affordance gates; no caster-context seam exists to resolve the caster's spell attack/damage modifier at render or roll time. Same as MA-0284. Fix needs numeric authored values or a caster-context seam.

## Join config
- test-campaign (header verified), EB exact search "Animated Object (Large)", Join Encounter → initiative "Animated Object (Large) 1" init 13, AC 15, HP 20/20, target armed Wild_Sage_Druid (HP 143→137 pre-existing from prior sessions; unchanged this probe).
Date: 2026-09-16
