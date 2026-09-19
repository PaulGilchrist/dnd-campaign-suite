# MA-0536 — Cultist Hierophant Spellcasting: inert row (zero spell chips, zero counters, orphaned DC 17)

**Verdict:** FAIL — MA-0532 Cultist Fanatic twin exact (MA-0421 markup gap), plus homebrew-spell aggravator.
**Date:** 2026-09-19 | **Campaign:** test-campaign only

## Row
- Monster: Cultist Hierophant (`cultist-hierophant`), actions[3] Spellcasting, actionType spellcasting
- Authored: spell_save_dc 17, save_dc 17, save_type Charisma, spellcasting_ability Charisma
- Description disk verbatim:
  `The cultist casts one of the following spells, using Charisma as the spellcasting ability (spell save DC 17):` + `\n<strong>At Will:</strong> Mage Armor (included in AC), Thaumaturgy\n<strong>1/Day Each:</strong> Jallarsi's Storm of Radiance (level 7 version), Mass Suggestion`
- Markup audit: ONLY tier headers are `<strong>`-wrapped; spell names Mage Armor / Thaumaturgy / Jallarsi's Storm of Radiance / Mass Suggestion are plain text. No `spell_list` field.

## Root cause (MA-0532 twin)
1. `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:288, regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`, skip tokens ending `:`) → both marked tokens are headers ending `:` → `spellNames=[]` → `SpellCastLinks` returns null (MonsterAction.jsx:63/194). Zero chips for all four spells.
2. `extractSpellcastingSpellUses` (:301): header `1/Day Each:` matches dayHeader → limit=1, but no marked spell name follows → `uses={}`. At-Will header resets limit. Counters invisible AND ungated.
3. MonsterAction.jsx:193 fork: rows named Spellcasting render `SpellCastLinks` XOR `ActionSaveRoll` — numeric row-level `save_dc:17` + `save_type:Charisma` are authored but NEVER render on a Spellcasting-named row → DC-orphan (MA-0532 ruling extends to Charisma/CR10 twin).
4. Zero fake-emphasis chips: header-only markup self-suppresses both extractors. `Mage Armor (included in AC)` is plain-text AC note, no skip-token handling needed (no chip exists to skip).

## Aggravator (beyond twin)
- `Jallarsi's Storm of Radiance` does NOT exist in `public/data/spells.json` (0 matches in 330 spells) — homebrew. Even after MA-0421 markup fix, `findMonsterSpell` cannot resolve it → chip would cast into nothing; row fix ALSO needs spells.json entry or prose removal. Mass Suggestion and Mage Armor DO exist in spells.json.

## Live proof (2026-09-19)
- EB join exact rows: Cultist Hierophant 1 (cs idx 0, AC16 HP144) + Bandit 1 (AC12 resistances [] clean victim, CHA save +0 raw) — cs verified twice: page.evaluate fetch + own curl (round 1, active None).
- Card open via avatar: Spellcasting row innerText byte-matches disk; `rowChipCount=0`; row affordance audit (a/button/[role=button]/dice-link) = `[]`; whole-card chip audit: initiative +8, six ability mods, 3 skill chips, two `+9` weapon chips (Pact Blade, Radiant Ray) — ZERO `.mc-dice-link-spell`, ZERO `.mc-dice-link-save`, no DC 17 chip, no counters.
- Zero cast legs reachable: no save prompt, no targetEffects, no condition possible on Bandit; no cast test possible (no chip to click) — FAIL twin exact, no uses-gate probeable.

## Cleanup
- Card closed, admin clear-change-data + clear-log (200 each), hard reload, own curl disk-check: change-data `{}` (zero target keys), log `[]`.

## Fix (DATA-only, rides MA-0421 template + spells.json)
Mark all spell names: `<strong>At Will:</strong> <strong>Mage Armor</strong> (included in AC), <strong>Thaumaturgy</strong>\n<strong>1/Day Each:</strong> <strong>Jallarsi's Storm of Radiance</strong> (level 7 version), <strong>Mass Suggestion</strong>` — and register Jallarsi's Storm of Radiance in spells.json (level 7, CHA save DC 17 semantics) or drop it from the row; otherwise markup yields a dead chip that can silently burn the 1/Day latch (MA-0421 double-defect precedent).
