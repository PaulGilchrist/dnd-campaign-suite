# BUG MA-0249 — Ancient Silver Dragon "Spellcasting": prose-only row → DC 23 never enforced, +15 spell-attack leg never reachable, save legs die at "DC Unknown"

## Overview
The Spellcasting action row (monsters.json ancient-silver-dragon actions[4]) is a bare `{name, description}` — no `save_dc`, no `spells` array, no `spell_attack_bonus`, no `delegates_to`. The card renders live per-spell chips and the prose-parsed 1/Day gate works, but the row's two numeric cores (DC 23, +15 to hit) are consumed by NOTHING: every save spell resolves at "DC Unknown" with damage silently abandoned, no spell on the row is attack-routable (so the +15 prose is dead code), and every non-damage spell is a CLA-325 advisory record with zero mechanical effect. This is the MA-0237 prose-only fingerprint (Ancient Red), with an extra MA-0245 misroute on the Ice Knife lv2 leg. Compare MA-0215 Ancient Gold (authored `save_dc:24` → live DC-enforced save legs) — the healthy shape this row lacks.

## Expected (row verbatim)
"The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23, +15 to hit with spell attacks): At Will: Detect Magic, Hold Monster, Ice Knife (level 2 version), Shapechange (Beast or Humanoid form only, no Temporary Hit Points gained from the spell, and no Concentration or Temporary Hit Points required to maintain the spell) 1/Day Each: Control Weather, Ice Storm (level 7 version), Teleport, Zone of Truth"

## Actual (live, test-campaign, round 14, HW armed via initiative target-select, targetName=HeroesFeastBard)
Row is NOT inert — 10 chips render (8 authored spells + MA-0215 pseudo-links "Concentration", "Temporary Hit Points"); 1/Day counters show "(1/Day · 1 left)". But per spell:
- Hold Monster: `ability_use` advisory only — "…Spell effect is recorded; GM-enforced for monsters." No save prompt, no DC 23/WIS, no `saveResult-*`, HW zero state.
- Detect Magic (At Will): advisory log, correctly ungated (no uses stamp).
- Ice Knife: misroutes to block-save (MA-0245 fingerprint — 5e spells.json Ice Knife has NO `attack_type`; 2024 sibling has `ranged`; findMonsterSpell resolves 5e-first → isSpellAttackSpell false). Prompt popup: **"DEX … DC Unknown — no success or failure"**; rolls queued (dragon + HW `roll` log entries, totals 7/7); NO `save_result`, NO `ability_use` cast record, NO damage, HW zero state. Dead leg.
- Ice Storm (1/Day): same — DC Unknown DEX prompt, rolls only, zero save_result/damage; BUT 1/Day spent at click (`monsterSpellUses:{"Ice Storm":1}` + "1/Day use spent — 0 remaining today" log) → charge paid for a mechanically dead cast (§4 cancel-keeps-charge convention, but the leg itself is dead). 2nd click: correct refusal — popupless `automation blocked` log "already cast Ice Storm today (1/Day) — Ice Storm refused", chip reads `(1/Day · 0 left)` + `mc-dice-link-spell-spent`. Gate logic itself PASSes.
- Zone of Truth (1/Day): spend + advisory record; canonical CHA save (2024 spells.json dc CHA) NOT rolled — advisory only.
- Shapechange: advisory record only; "Beast or Humanoid form only / no THP / no Concentration required" clauses have zero producer or consumer. "+15 to hit": never — see Likely Location.

## Steps
1. test-campaign → Initiative (dragon cs idx0 init 15 live); arm dragon target = HeroesFeastBard.
2. Open dragon card → Spellcasting row → 10 `.mc-dice-link-spell` chips, no DC chip, no +15 chip.
3. Click Hold Monster → advisory `ability_use` log, zero state.
4. Click Ice Knife → popup "DC Unknown — no success or failure"; log holds bare `roll` lines only; `saveResult-HeroesFeastBard` absent.
5. Click Ice Storm → DC Unknown prompt; `monsterSpellUses.{'Ice Storm':1}` written; 2nd click → `automation blocked … (1/Day)` refusal log, zero spend.
6. Click Zone of Truth / Shapechange → advisory records, no save/state.

## Likely Location
**DATA authoring (primary)** — monsters.json actions[4] lacks numeric `save_dc:23` (consumed at MonsterCardModal.jsx:815/218 `saveDc: action.save_dc`) and, for any attack leg, `spell_attack_bonus:15` or 5e `attack_type` on Ice Knife (prose `monsterSpellAttackBonus` at :692 IS parsed but only reached when `isSpellAttackSpell(spell)` is true, :1196 — false for all 8 listed spells because the 5e-first lookup finds no `attack_type`). Engine consumers (block-save DC, attack seam, 1/Day gate at :777/1185) are live and correct — MA-0215 parity proves it. Fix shape: author `save_dc:23` (+ `save_type: Charisma`) on the row; add `attack_type:"ranged"` to 5e Ice Knife (MA-0245 fix, shared) for the lv2 attack leg.

## Notes
- Advisory legs (Detect Magic/Hold Monster/Shapechange/Control Weather/Teleport/Zone of Truth — all no-damage in app spells.json) fall to CLA-325 "GM-enforced for monsters" records — accepted CLA-325 precedent as display/record, BUT here it swallows DC-bearing spells (Hold Monster WIS, Zone of Truth CHA) whose saves are canonical and enforceable; the row cannot express them because the save route is only entered for damage spells anyway (spellHasDamage gate, :1204).
- 1/Day gate + At-Will ungated + refusal log all PASS — the only fully healthy subsystem.
- MA-0215 pseudo-link pitfall reproduces (Concentration / Temporary Hit Points chips; click → console "spell not found").
- Residue left: `monsterSpellUses {"Ice Storm":1,"Zone of Truth":1}` (GM/admin-side reset, no rest hook §7); EP's MA-0248 Paralyzed/Incapacitated untouched (did not interfere).
- grep proof of no prose-DC consumer: only `action.save_dc` reads (MonsterCardModal.jsx:218,815); "spell save DC" string appears solely inside the gated advisory-log builder (:671).
