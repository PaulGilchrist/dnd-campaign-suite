# BUG MA-0284 — Animated Object (Huge) · Slam — FAIL (inert by design gate)

## Row
`animated-object-huge` actions[0] "Slam", attackType attack, reach 5 ft.
Authored: `attack_bonus: null`, `damage_dice_primary: "2d12+3+spellcasting modifier"` (force).
2024 PHB caster-dependent monster: attack/damage inherit the caster of Animate Objects. No `spellcasting_ability`/attack fields; base mods str+3/dex0/con0/int-4/wis-4/cha-5; `proficiency_bonus: null`.

## Evidence (test-campaign, :5173, 2026-09-16)
- New join via EB (exact-name search, 1 row, count 1, Join Encounter). cs: "Animated Object (Huge) 1", init 13, AC 15, HP 40, saveBonuses str+3…cha-5, target armed = Wild_Sage_Druid (persisted across reload).
- Monster card (`.mc-overlay`) Slam row HTML: `<div class="mc-action"><strong>Slam.</strong> <span>Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 2d12+3+spellcasting modifier Force damage.</span></div>`
- **No attack chip** — card `.mc-dice-link` list = ability chips only (STR +3, DEX +0 … mc-ability-mod). Zero clickable elements inside the Slam row (`querySelectorAll('span.mc-dice-link,b.clickable,button')` → `[]`).
- Clicked label + description span (×2-3): **no popup, no prompt, no roll**. Log tail unchanged (last entry still initiative-roll ts 1789541660855); zero new `roll`/`ability_use`/`hp_change` lines.
- Engine invented NO numeric — nothing resolves; no garbage math either. Pure inert text.

## Root cause (code)
- `MonsterAction.jsx:163` `actionHasAttack = action.attack_bonus != null` → null → attack chip not rendered (:178-181).
- `MonsterAction.jsx:31-36` (`ActionDamageLinks`): only fires when both save_dc/attack_bonus null (our case), but damage chip needs `canRollExpression(actionDamageFormula)`; formula "2d12+3+spellcasting modifier" fails `canRollExpression` (MA-0014 "unrollable formula = plain text only") → both legs suppressed. Caster-dependent rows have no authored numeric and no caster-context consumer → unplayable.

## Expected
Caster-dependent: attacker's spell attack modifier and spellcasting modifier must be supplied. App should either
(a) require authored numeric on such rows (GM authors `attack_bonus` + numeric damage), or
(b) implement a caster-context consumer: row carries `spellcasting_ability` (or Animate-Objects source-caster te) so the resolver derives +spell attack mod and folds "+spellcasting modifier" into damage.
Canonical note: bonus/damage = caster's spell attack/damage mod; base statblock mods (str+3 etc) are NOT the attack bonus.

## Verdict
FAIL — inert row: no chip, no resolution, no log. Same family as MA-0237 "null numeric → dead leg" (here both legs dead at render, so even the MA-0237 popup never appears).

## New-join config
EB search "Animated Object (Huge)" → checkbox → Join Encounter → initiative card idx 3 → `target-select` = Wild_Sage_Druid → avatar click opens card (state key `combat-ui-viewingMonster`). Do NOT rip `.mc-overlay` from DOM (React state persists, modal won't remount — reload instead).
