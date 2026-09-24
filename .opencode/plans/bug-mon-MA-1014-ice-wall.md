# BUG MA-1014 — Ice Devil "Ice Wall": row inert, no affordance (FAIL(b))

**Date:** 2026-09-23 · **Campaign:** test-campaign · **Rig:** Ice Devil 1 joined (ini 11), Bandit 1 AC12 754/999 armed

## Disk truth (public/data/monsters.json, Ice Devil actions[3])
`{"name":"Ice Wall","description":"The devil casts <strong>Wall of Ice</strong> (level 8 version), requiring no spell components and using Intelligence as the spellcasting ability (spell save DC 17).","spell_save_dc":17,"spellcasting_ability":"Intelligence","recharge":"6"}`
— spell_save_dc 17, Intelligence, recharge "6", NO save_dc / range / save_effect / damage fields.

## Rendered affordance (verbatim, fresh card)
`<div class="mc-action "><strong>Ice Wall.</strong> <span>The devil casts <strong>Wall of Ice</strong> …(spell save DC 17).</span><em> (6)</em></div>`
ZERO `mc-dice-link` chips, ZERO DC chip ("spell save DC 17" is inline cosmetic prose only), ZERO buttons/role=button, no cursor-pointer. Recharge renders as static italic `(6)` label — no spent state, no gate UI.

## Live press evidence (budget 1, native el.click() on row)
- No modal/picker/popup, no DOM change, no `.mc-recharge-refusal` (§100/MA-0963 picker never reachable — nothing clickable exists).
- Log delta ZERO (tail unchanged: MA-1013 Tail entries). `Ice Devil 1.monsterRecharge` stays `null` — gate machine never sees this row.
- Bandit 1: activeConditions [], targetEffects absent, spellTarget absent; `__map__.activeMapName` null (no zone/terrain).
- Console 0 errors.

## Renderer gap (byte-located)
- `MonsterAction.jsx:259` `actionHasSave = action.save_dc != null` — row carries `spell_save_dc`, NOT `save_dc` → :288 ActionSaveRoll never mounts; `ActionSaveRoll:92` has the same `save_dc`-only gate.
- `MonsterAction.jsx:267` `isSpellcastingRow = /^spellcasting$/i.test(action.name)` — "Ice Wall" ≠ "Spellcasting" → SpellCastLinks (:286) never mounts even though `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:356) would match `<strong>Wall of Ice</strong>` markup.
- No damage fields + :45 gate → ActionDamageLinks null. `spell_save_dc` appears in card code ONLY as `isSpellOriginAction` marker (MonsterCardModal.jsx:1007) for attack-chip against_spell tagging — never produces an affordance.
- RechargeNote (:293) renders the static "(6)" but spend/refusal machinery (rechargeSpent, :263) has no clickable to consume it.

## Fix lane
Spell-transport for spell_save_dc-only zone/utility rows: either mount SpellCastLinks when `action.spell_save_dc != null` (chip "Wall of Ice · DC 17 INT · Recharge 6" routing to a zone/placement advisory or save picker), or normalize `spell_save_dc`→`save_dc` at load. Recharge gate (MA-0963/0968/0977 spend-at-picker-open, d6 recovery) then inherits via existing rechargeOut plumbing. No manifest edit, no git writes; rig left intact, Ice Devil joined, Bandit 754/999.
