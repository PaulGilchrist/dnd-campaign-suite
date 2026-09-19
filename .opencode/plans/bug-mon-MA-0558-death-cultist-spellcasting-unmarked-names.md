# bug-mon-MA-0558-death-cultist-spellcasting-unmarked-names.md

**Row:** MA-0558 — Death Cultist (death-cultist), action 3, Spellcasting (spellcasting), saveDc 14
**Verdict:** FAIL (inert) — twin fingerprint MA-0524/0532
**Date:** 2026-09-19 · test-campaign · localhost:5173

## Symptom
Spellcasting row renders ZERO castable chips. DC 14 is orphaned — no affordance consumes it.

## Disk truth (`public/data/monsters.json`)
```json
{
  "name": "Spellcasting",
  "description": "The cultist casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 14):\n<strong>At Will:</strong> Speak with Dead, Thaumaturgy",
  "spell_save_dc": 14,
  "spellcasting_ability": "Wisdom"
}
```
Only the tier header `At Will:` is `<strong>`-wrapped. Spell names **Speak with Dead** and **Thaumaturgy** are plain text.

## Live proof (Playwright)
- EB-joined `Death Cultist 1` (idx0), card opened via avatar `.mc-overlay`.
- `.mc-action` Spellcasting container: `anyChips [role=button]` = `[]`; `.mc-dice-link`/`.mc-dice-link-spell` = `[]`.
- Rendered row HTML: names plain-text inside `<span>`; only `Spellcasting.` + `At Will:` strong-wrapped.
- No chip → no cast probe possible (skipped per instructions).

## Mechanism
`extractSpellNamesFromSpellcasting` (MonsterCardHelpers) requires `<strong>/<em>` on EACH spell name (MA-0421). Plain-text names → `[]` → SpellCastLinks renders nothing. Row named "Spellcasting" renders SpellCastLinks XOR ActionSaveRoll, so row-level `spell_save_dc: 14` never reaches `buildAbilitySaveRollContext` (MA-0532) → DC orphan.

## Spells resolvable
`Speak with Dead` and `Thaumaturgy` both present in `public/data/spells.json` and `public/data/2024/spells.json` — fix is markup-only.

## Fix (DATA, MA-0421 archmage/lich byte-shape template)
```
<strong>At Will:</strong> <strong>Speak with Dead</strong>, <strong>Thaumaturgy</strong>
```
Strip-tags byte-equality proves markup-only diff; JSON.parse + full git diff after (prose anchors not monster-unique).

## Cleanup
Joined combatant removed (`npc-remove-btn` + confirm); combatSummary re-verified free of Death Cultist. Registry MA-0558 merge-appended under Death Cultist, JSON.parse disk-checked.
