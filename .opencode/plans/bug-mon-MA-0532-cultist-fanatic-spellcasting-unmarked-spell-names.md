# MA-0532 — Cultist Fanatic Spellcasting: inert row (zero spell chips, zero counters)

**Verdict:** FAIL — MA-0524 Couatl exact-ruling twin (MA-0421 markup gap), stricter: numeric save_dc ARE authored yet unreachable.
**Date:** 2026-09-19 | **Campaign:** test-campaign only

## Row
- Monster: Cultist Fanatic (`cultist-fanatic`), actions[1] Spellcasting, actionType spellcasting
- Authored: spell_save_dc 12, spell_attack_bonus 4, save_dc 12, save_type Wisdom, spellcasting_ability Wisdom
- Description disk verbatim:
  `The cultist casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 12, +4 to hit with spell attacks):` + `\n<strong>At Will:</strong> Light, Thaumaturgy\n<strong>2/Day:</strong> Command\n<strong>1/Day:</strong> Hold Person`
- Markup audit: ONLY tier headers are `<strong>`-wrapped; spell names Light/Thaumaturgy/Command/Hold Person are plain text. No `spell_list` field.

## Root cause
1. `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:288, regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`, skip tokens ending `:`) → all marked tokens are headers ending `:` → `spellNames=[]` → `SpellCastLinks` returns null (MonsterAction.jsx:63). No chips for Light/Thaumaturgy/Command/Hold Person.
2. `extractSpellcastingSpellUses` (:301) binds N/Day limits ONLY to marked names: header 2/Day sets limit=2, 1/Day overwrites limit=1, no marked name ever follows → `uses={}`. Counters invisible AND ungated.
3. NEW pitfall: MonsterAction.jsx:193 fork — rows named Spellcasting render `SpellCastLinks` OR `ActionSaveRoll`, never both. Since spellNames=[], the row shows ZERO affordances despite numeric `save_dc:12` + `save_type:Wisdom` being authored at row level (they never render on a Spellcasting-named row; MA-0524's "spell_save_dc never reaches buildAbilitySaveRollContext" extends: even numeric row-level save_dc is orphaned by the fork).
4. Zero fake-emphasis chips (contrast Couatl's Concentration/Temporary Hit Points tokens) — header-only markup self-suppresses both extractors.

## Live proof (2026-09-19)
- EB join exact rows: Cultist Fanatic 1 + Bandit 1 (WIS +0 raw d20 vs DC 12, resistances [], staged 200/999 HP via full-store `/combatSummary` `{value}` POST).
- Card open: Spellcasting row innerText verbatim, `rowChipCount=0`; whole-card audit `.mc-dice-link-spell` / `.mc-dice-link-save` / `.mc-dice-link-legendary` = `[]` (only Pact Blade +4 chip on row 0).
- No Command/Hold Person chip → zero cast legs reachable: no save prompt, no `targetEffects`, no condition on Bandit, change-data `monsterSpellUses` null (no use-economy ever engaged).
- Cleanup: card closed, admin cleared change-data + log, disk-checked `{}` / `[]`.

## Fix (DATA-only, rides MA-0421 template)
Wrap all four spell names in `<strong>` per archmage/lich byte-shape:
`<strong>At Will:</strong> <strong>Light</strong>, <strong>Thaumaturgy</strong>\n<strong>2/Day:</strong> <strong>Command</strong>\n<strong>1/Day:</strong> <strong>Hold Person</strong>`
Row already carries numeric save_dc/save_type, so chips + counters (Command 2/Day, Hold Person 1/Day via monsterSpellUses) activate with markup alone. Byte-strip proof required (tag-only diff). Bonus-action Spiritual Weapon (uses 2/Day, `<em>`-marked in description) is a separate row — unaffected.
