# BUG MA-1019 — Imp "Invisibility": row inert, no affordance (FAIL(b))

**Date:** 2026-09-23 · **Campaign:** test-campaign (header verified) · **Rig:** Imp 1 joined idx1 (ini 20, 21/21), Bandit 1 AC12 719/999 armed · :5173 reused (curl 200)

## Disk truth (public/data/monsters.json, Imp actions[1])
`{"name":"Invisibility","description":"The imp casts <strong>Invisibility</strong> on itself, requiring no spell components and using Charisma as the spellcasting ability.","spellcasting_ability":"Charisma"}`
— spellcasting_ability Charisma ONLY. NO save_dc, NO spell_save_dc, NO recharge, NO uses, NO automation fields (confirmed).

## Rendered affordance (verbatim, live card)
`<div class="mc-action "><strong>Invisibility.</strong> <span>The imp casts <strong>Invisibility</strong> on itself, requiring no spell components and using Charisma as the spellcasting ability.</span></div>`
ZERO `mc-dice-link` chips, ZERO buttons/role=button (queried: buttons 0, roleButton 0, diceLinks 0), cursor:auto, ZERO `<em>` — nothing clickable in the row.

## Live press evidence (budget 1, native el.click() on row)
- No modal/picker/target-point prompt; modal count 0→0; row outerHTML byte-identical after click.
- Log delta ZERO: count 500 before and after; tail still `7b2c54b3… roll Sting dmg 9→Bandit 1` (MA-1018 Sting residue).
- changedata: `Imp 1` keys stay [lastAttackRoll, _lastRollContext, pendingCombatSuperiorityPrompt]; no hidden/invisible keys on the creature; `targetEffects` has ZERO Imp entries; `monsterRecharge` null, `monsterSpellUses` null.
- Card closed cleanly via ×; console 0 errors.

## Renderer gap (byte-located) — MA-1014/1016 twin + invisibility seam unreachable
- `MonsterAction.jsx:267` `isSpellcastingRow = /^spellcasting$/i.test(action.name||'')` — "Invisibility" ≠ "Spellcasting" → `SpellCastLinks` (:285) never mounts, EVEN THOUGH `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:356, `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`) matches `<strong>Invisibility</strong>` and Invisibility is a real spell (spells.json:5929); `handleSpellCast` (MonsterCardModal.jsx) would route it (self-target/no-save → CLA-325 advisory lane per MA-1016).
- A LIVE generic invisibility seam exists but keys off `automation`, not prose: `SelfBuffLink` (MonsterAction.jsx:224-225) requires `isMonsterSelfBuffRow` (monsterSelfBuff.js:25-27 `automation.type==='monster_self_buff' && automation.effect`) — the Duergar MA-0658 / Green Hag MA-0919 rows carry `automation:{type:"monster_self_buff",effect:"invisible",rounds:600}` and grant te `invisible` on self + clock + enders (MonsterCardModal.jsx:1895/2035). Imp's row has NO automation field → self-buff affordance never mounts. This is the difference from MA-1014/1016: here a fully-wired invisibility applicator exists one gate away.
- `actionHasSave` false (`save_dc == null`, :259) → ActionSaveRoll null; no attack_bonus/damage dice → no chips; `spellcasting_ability` is prose pass-through only (grep: tests + card pass-through, no affordance branch).
- monsterLegendaryUses.js:249-266 invisibility advisory is legendary-action-only (MA-0058 Cloaked Flight) — unreachable from this regular action row.

## Fix lane
Generic self-spell transport OR invisibility te wiring: either (a) loosen :267 to mount SpellCastLinks when the extractor finds spell names (`isSpellcastingRow || spellNames.length>0`), letting handleSpellCast advisory-route the self-target cast, or (b) normalize Imp-style self-cast rows at load to `automation:{type:"monster_self_buff",effect:"invisible"}` so the live SelfBuffLink seam (te `invisible` on self, attack/cast enders, MA-0658 copy) arms with zero new UI. (b) reuses the existing invisibility consumer verbatim — preferred. No manifest edit, no git writes; rig left intact (Imp 1 joined 21/21, Bandit 719/999, log 500).
