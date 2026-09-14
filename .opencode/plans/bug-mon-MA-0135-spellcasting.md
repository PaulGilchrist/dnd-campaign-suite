# BUG MA-0135 — Adult Silver Dragon Spellcasting: "(level 5 version)" upcast clause rolls BASE dice

**Verdict:** FAIL (upcast clause) — row FAILs on the authored Ice Storm "(level 5 version)" save-leg clause. All other legs PASS.

## Row
- id: MA-0135 | monster: Adult Silver Dragon (adult-silver-dragon) | action: Spellcasting
- Authored (public/data/monsters.json:2466 block): spell save DC 19, Charisma, +11 spell attacks; At Will: Detect Magic, Hold Monster, Ice Knife, Shapechange (Beast/Humanoid only, no THP, no concentration); 1/Day Each: Ice Storm (level 5 version), Zone of Truth
- Data check PASS: `save_dc: 19`, `save_type: "Charisma"`, full list + "(level 5 version)" clause match the row exactly.

## Confirmed working (live, test-campaign, 2026-09-14)
- Spell list renders exactly: `.mc-dice-link-spell` links "Detect Magic", "Hold Monster", "Ice Knife", "Shapechange", "Ice Storm (1/Day · 1 left)", "Zone of Truth (1/Day · 1 left)".
- Save-forcing cast (Ice Storm) → sp-modal "ElderPaladin must make a DEX saving throw. DC 19 / Half damage on successful save"; `save_result` change-data {saveDc:19, saveType:"DEX", success:false}. DC 19 = 8 + CHA + PB confirms Charisma derivation (advisory log "casts … via Spellcasting (spell save DC 19…)" on Hold Monster, MA-0091 bar met).
- 1/Day gate fully enforced: spend log "1/Day use spent — 0 remaining today"; change-data `monsterSpellUses {"Ice Storm":1}` on "Adult Silver Dragon 1"; counter flips to "(1/Day · 0 left)"; two re-clicks → TWO `automation blocked` "already cast Ice Storm today (1/Day) — Ice Storm refused" logs, uses stay 1 (zero-spend), zero damage.
- Hold Monster (save, no damage) resolves advisory "GM-enforced for monsters" — accepted CLA-325/MA-0003 non-damage model, noted not counted against.

## FAIL clause — save-leg upcast rolls BASE dice
Live evidence (log, decisive):
```json
{"type":"roll","name":"Ice Storm","rollType":"save-damage","characterName":"Adult Silver Dragon 1","targetName":"ElderPaladin","formula":"2d8 plus 4d6","rolls":[7,5,4,2,1,1],"total":20,"finalDamage":20,"damageType":"Bludgeoning","saveSuccess":false}
```
- Row authors "Ice Storm (level 5 version)" → expected 3d8 bludgeoning + 4d6 cold (base lv4 2d8 + 1d8 per slot above 4th, spells.json higher_level).
- Cast rolled BASE `formula:"2d8 plus 4d6"` — popup "Ice Storm 2d8 plus 4d6: 7,5,4,2,1,1" — the "(level 5 version)" clause is ignored.
- Cause (static, unchanged since MA-0112/MA-0091): `executeMonsterSaveSpellCast` calls `spellDamageFormulaAtBaseLevel(spell)` (src/components/encounter/MonsterCardModal.jsx:641); `spellCastLevelFromSpellcasting` / `spellDamageFormulaAtLevel` are wired only on the spell-ATTACK branch (:590-591). Save-leg rows with authored upcast clauses roll base — known residual, now failing this row under the strict bar.

## Fix suggestion
In `executeMonsterSaveSpellCast` (MonsterCardModal.jsx:641) resolve cast level via existing `spellCastLevelFromSpellcasting(action.description, spellName, spell)` and pass `spellDamageFormulaAtLevel(spell, castLevel)` into `handleSaveRoll` — mirror the attack-branch wiring at :590.

## Evidence capture
Live Playwright run on http://localhost:5173, test-campaign, EB Join "Adult Silver Dragon 1" (hp 216, cs idx 0), ElderPaladin armed via dragon-card `[data-testid="target-select"]` (cs.targetName confirmed server-side). Cleanup: Admin clear change-data + log on test-campaign only (API); manifest `verified` untouched.
