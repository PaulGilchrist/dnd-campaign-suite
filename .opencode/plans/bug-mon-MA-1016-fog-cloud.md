# BUG MA-1016 — Ice Mephit "Fog Cloud": row inert, no affordance (FAIL(b))

**Date:** 2026-09-23 · **Campaign:** test-campaign (header verified) · **Rig:** Ice Mephit 1 joined (ini 7, 21/21), Bandit 1 AC12 749/999 armed · :5173 reused (curl 200)

## Disk truth (public/data/monsters.json, Ice Mephit actions[1])
`{"name":"Fog Cloud","description":"The mephit casts <strong>Fog Cloud</strong>, requiring no spell components and using Charisma as the spellcasting ability.","spellcasting_ability":"Charisma","uses":"1/Day"}`
— spellcasting_ability Charisma, uses "1/Day" on the row; NO spell_save_dc, NO save_dc, NO recharge, NO automation/zone fields. (Task expected "likely spell_save_dc/recharge" — disk says otherwise: neither exists.)

## Rendered affordance (verbatim, live card)
`<div class="mc-action "><strong>Fog Cloud.</strong> <span>The mephit casts <strong>Fog Cloud</strong>, requiring no spell components and using Charisma as the spellcasting ability.</span></div>`
ZERO `mc-dice-link` chips, ZERO buttons/role=button (queried: buttons 0, roleButton 0, diceLinks 0), cursor:auto, ZERO `<em>` — "uses 1/Day" from disk does NOT render (formatActionUsage reads `action.usage`, absent), so no recharge/uses italic at all.

## Live press evidence (budget 1, native el.click() on row)
- No modal/picker/target-point/zone prompt; modal count 0→0, popup none, body innerHTML delta 0.
- Log delta ZERO: count 500 before and after; tail still `fd5462e7… hp_change Bandit 1 -5 → 749/999`.
- changedata: `Ice Mephit 1.monsterRecharge` null, `monsterSpellUses` null, no fog/target keys; `__map__.activeMapName` null — no zone/fog overlay.
- Console: 0 errors.

## Renderer gap (byte-located) — MA-1014 twin, extractor-matches-but-unreachable
- `MonsterAction.jsx:267` `isSpellcastingRow = /^spellcasting$/i.test(action.name||'')` — "Fog Cloud" ≠ "Spellcasting" → `SpellCastLinks` (:285) never mounts, EVEN THOUGH `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:356, `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`) would match `<strong>Fog Cloud</strong>` and produce a live chip wired to `handleSpellCast` (MonsterCardModal.jsx:2022). This is the one difference from MA-1014: here the extractor match is real (Fog Cloud is in spells.json and the name has no trailing colon), so the gate alone is the sole blocker.
- `actionHasSave` false (`save_dc == null`, :259) → ActionSaveRoll null. No attack/damage fields → no chips. ZoneAuraLink/SummonLink/SelfBuffLink key off automation fields absent on this row. Fog handling exists but is unwired to this row: weatherService.js:57 `fog` is weather-table generation; targetEffectDefinitions.js:1113 `lair_fog_cloud` is lair-action-only.
- `spellcasting_ability` in components appears only in tests + as data pass-through; no affordance branch keys off it (grep `spellcasting_ability src/components/` → tests only).

## Fix lane
Loosen the :267 gate to mount SpellCastLinks when the extractor finds spell names (e.g. `isSpellcastingRow || spellNames.length > 0`), or normalize per-spell utility rows at load. `handleSpellCast` already routes non-damage non-save zone spells through the CLA-325 advisory path (MonsterCardModal.jsx:2070+), and `extractSpellcastingSpellUses` would honor "1/Day" if the uses header were parseable from the row. No manifest edit, no git writes; rig left intact (Ice Mephit 1 joined, Bandit 749/999, log 500).
