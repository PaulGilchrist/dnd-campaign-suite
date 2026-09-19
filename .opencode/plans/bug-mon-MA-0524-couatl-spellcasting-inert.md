# bug-mon-MA-0524 — Couatl Spellcasting INERT (fake emphasis chips only)

**Verdict:** FAIL (inert, MA-0454 Bog Sage precedent)
**Campaign:** test-campaign | **Date:** 2026-09-19
**Monster:** Couatl (couatl) | **Action:** Spellcasting (index 2)

## Row (disk, public/data/monsters.json)
```
"Spellcasting"
description: "The couatl casts one of the following spells ... (spell save DC 15):
  <strong>At Will:</strong> Detect Evil and Good, Detect Magic, Detect Thoughts, Shapechange (Beast or Humanoid form only, no Temporary Hit Points gained from the spell, and no <strong>Concentration</strong> or <strong>Temporary Hit Points</strong> required to maintain the spell)
  <strong>1/Day Each:</strong> Create Food and Water, Dream, Greater Restoration, Scrying, Sleep"
spell_save_dc: 15
spellcasting_ability: Wisdom
```
No numeric `save_dc`, no `save_type`, no `spell_list`, no usage counters authored.

## Extraction behavior (MonsterCardHelpers.js:288 extractSpellNamesFromSpellcasting)
- Regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`, skips tokens ending `:`.
- Couatl marked tokens: `At Will:` (skipped), `1/Day Each:` (skipped), `Concentration`, `Temporary Hit Points` (KEPT — false positives, prose emphasis not spell names).
- All REAL spell names (Detect Evil and Good, Detect Magic, Detect Thoughts, Shapechange, Create Food and Water, Dream, Greater Restoration, Scrying, **Sleep**) are UNMARKED -> extracted as zero.
- `extractSpellcastingSpellUses`: `1/Day Each:` header sets limit=1, but no marked spell name follows -> uses={} -> no counters.
- `ActionSaveRoll` (MonsterAction.jsx) gates on `action.save_dc` (null here; row authors `spell_save_dc` only, which never reaches `buildAbilitySaveRollContext` — MA-0237/#89) -> no Spellcasting DC/save chip.

## Live proof (Playwright, EB join Couatl 1 + Bandit 1)
- Spellcasting row renders exactly TWO `.mc-dice-link-spell` chips: `Concentration`, `Temporary Hit Points`. Zero real-spell chips. No `At Will` / `1/Day` counter text. No Spellcasting DC affordance (visible `DC 15 Strength` chip belongs to the Constrict row).
- Clicked `Concentration` chip -> console error `Spell 'Concentration' not found in spells.json`; NO `.sp-modal` save prompt, NO popup/picker.
- Bandit `activeConditions` = null; top-level `targetEffects` = null; Couatl `monsterSpellUses` = null (no slot / use spent).
- Log gained a BOGUS `ability_use` `Couatl 1 casts Concentration` (advisory `buildMonsterSpellCastEntry`, routesToSave=false) naming a NON-spell with zero adjudication.
- **Sleep** (the only offensive save DC 15 spell here) has ZERO affordance -> cannot be cast/promoted.

## Precedent
MA-0454 Bog Sage (inert FAIL(b)) — double-defect: MA-0421 markup gap (names unmarked -> no chips) AND MA-0237 prose/spell_save_dc gap (no numeric save_dc -> no save leg). Same byte shape here.

## Fix (DATA, one pass, rides both templates)
1. Wrap every real spell name in `<strong>`/`<em>` (MA-0421 archmage/lich byte-shape; strip-tags byte-equality proves markup-only diff).
2. Author numeric `save_dc: 15` + `save_type` on the row so the DC reaches `buildAbilitySaveRollContext` (MA-0237/0318/0328 pattern).
3. Remove `<strong>` around `Concentration` / `Temporary Hit Points` (cosmetic false chips producing bogus cast logs).

## Cleanup
Admin-cleared change-data + log (curl 200, no dialog); re-verified empty (log 0, combatSummary creatures 0). No manifest/git writes.
