# MA-0572 — Death Knight Aspirant Spellcasting: unmarked spell names → zero chips (FAIL(b) inert)

**Date:** 2026-09-19 · **Campaign:** test-campaign · **Twin:** MA-0564 (Death Knight, byte-similar text, same verdict)

## Row
- monsterIndex: `death-knight-aspirant`, actions[3] `Spellcasting`, manifest saveDc 15
- Disk description: `... using Charisma ... (spell save DC 15):\n<strong>At Will:</strong> Phantom Steed\n<strong>1/Day Each:</strong> Destructive Wave (Necrotic), Dispel Magic`

## Defect
Only tier headers are `<strong>`-marked; all three spell names (Phantom Steed, Destructive Wave, Dispel Magic) are PLAIN TEXT.

- `extractSpellNamesFromSpellcasting` (`src/services/.../MonsterCardHelpers.js:288`) matches `<strong|em>` tokens and skips `:`-terminated headers (:295) → `spellNames=[]` → SpellCastLinks renders null → zero spell chips.
- `extractSpellcastingSpellUses` (:301) binds 1/Day only to MARKED names → `uses={}` → Destructive Wave/Dispel Magic 1/Day limit invisible AND ungated.
- Row named "Spellcasting" renders SpellCastLinks XOR ActionSaveRoll (MA-0532) → `spell_save_dc:15` orphan; never renders as a chip.

## Live proof (EB join, card `.mc-overlay`)
- Joined `Death Knight Aspirant 1` (cs idx0, currentHp 178), opened via avatar.
- Spellcasting `.mc-action`: `role=button`=0, `.mc-dice-link`=0, spellChips=0; card-wide `.mc-dice-link-spell`=0.
- Negative control same card: Dread Blade `+9` chip + Hellfire Orb `6d6` + `DC 15 Dexterity` chips render → renderer healthy; row inert.
- Cleanup: `.npc-remove-btn` + confirm-override; cs re-GET verified zero Aspirant.

## Spells DB
- Destructive Wave: 2024-ONLY (`public/data/2024/spells.json`; 5e `spells.json` grep-zero) — noted.
- Phantom Steed, Dispel Magic: standard 5e, resolvable — markup-only fix.

## Fix (DATA, MA-0421 archmage/lich template)
`<strong>`-wrap EACH spell name in actions[3] description:
`<strong>At Will:</strong> <strong>Phantom Steed</strong> / <strong>1/Day Each:</strong> <strong>Destructive Wave</strong> (Necrotic), <strong>Dispel Magic</strong>` — byte-strip equality proof; anchors non-unique across monsters (MA-0564 twin shares text) — edit by monster index + `git diff`.

## Class precedent
MA-0421 / MA-0524 / MA-0532 / MA-0552 / MA-0558 / MA-0564
