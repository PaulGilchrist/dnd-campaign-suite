# BUG mon-MA-0005 — Aarakocra Aeromancer · Spellcasting (FAIL)

**Row:** MA-0005 · monster "Aarakocra Aeromancer" · actionType spellcasting · expected: cast Elementalism / Gust of Wind / Mage Hand / Message (At Will) + Lightning Bolt (1/Day), WIS save DC 13, per-spell effects.
**Run date:** 2026-09-13 · campaign test-campaign · target AberrantSorcerer (WIS −1) armed via initiative target-select.

## Verdict: FAIL — generic block save only; spells themselves have zero consumer; 1/Day untracked.

## Static grep evidence
- `public/data/monsters.json` `aarakocra-aeromancer` Spellcasting: `save_dc 13, save_type Wisdom` — DC correct (8 + WIS 3 + PB 2 = 13 ✓). Spell list lives ONLY inside `description` HTML; no structured `spells[]`, no `uses`, no per-spell damage/effect fields.
- `src/components/encounter/MonsterAction.jsx` `ActionSaveRoll` (:30-50): renders exactly ONE `.mc-dice-link` "DC {save_dc} {save_type}" when `save_dc != null` and description has no damage dice. No spell-name parsing / chooser anywhere in the file (`rg -i spell` in MonsterAction.jsx = zero hits).
- `src/components/encounter/MonsterCardModal.jsx:578` `handleSaveRoll`: anonymous `rollSavingThrow(save_type vs armed target)` with `autoDamageFormula null`, `dcSuccess:'half'` boilerplate. No spell dispatch, no spell attribution in payload.
- Grep `At Will|spellList|perSpell` in src: all hits are PC wizard/feat code (warMagicCantripHandler, spellValidation), zero monster-card consumers.
- `Gust of Wind` live consumers: grep-zero (MA-0003 precedent, re-confirmed). spells.json `gust_of_wind`/`elementalism` automation not consumed by any monster path.
- 1/Day: no `usage`/uses field on the monsters.json action; `MonsterAction.jsx:71` renders `action.usage` display-only and data is null — no uses-tracking key produced or enforced anywhere.

## Live probe results (.mc-overlay, localhost:5173)
1. Spellcasting row DOM: ONE link `DC 13 Wisdom` (`mc-dice-link-save-clickable`); spell names appear only as inert description text; zero `a/button/.clickable` elements in the row; no uses counter rendered.
2. Click 1: `.sp-modal` "Saving Throw Required — AberrantSorcerer must make a WISDOM saving throw. DC 13. Half damage on successful save" — DC/type correct, NO spell named. Roll Save → nat 20 −1 = 19 vs 13 SUCCESS. Log: `save_result` DC 13 Wisdom + anonymous `roll save WIS` (name "WIS", no spell). targetEffects: none. HP 41 → 41.
3. Click 2 (repeat = Lightning Bolt 1/Day probe): same prompt offered again with ZERO gating — no uses check, no refusal, no "already cast today" state. Roll → 7 −1 = 6 vs 13 **SAVE FAILURE**. On failure: `damage entries: []`, `targetEffects: null` (campaign + top-level), AberrantSorcerer store keys empty, HP unchanged 41→41, log spell-name mentions: **[]** (zero entries reference Elementalism/Gust of Wind/Mage Hand/Message/Lightning Bolt).
4. No chooser path exists → Lightning Bolt cannot be selected at all; second same-fight use unconstrained.

## Conclusion
Row mechanics inert for every listed spell: the only firing artifact is an anonymous block WIS save vs DC 13 (popup "Half damage" text is false — no damage/condition/effect ever applied, even on save fail). 1/Day Lightning Bolt has no uses tracking and no enforcement (project rule: unenforced uses = FAIL). DC and save ability themselves are correct; the spellcasting feature itself is unimplemented per-spell.

## Fix surface (for future ticket)
Structured spell list on the monster action + per-spell chooser modal in MonsterCardModal (modalSpells route), per-spell save/damage/effect resolution, and `usage` tracking keyed per-combat/per-day with refusal logging.
