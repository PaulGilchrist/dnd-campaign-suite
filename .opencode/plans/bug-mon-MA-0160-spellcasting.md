# BUG MA-0160 — Ancient Black Dragon Spellcasting: "(level 5 version)" upcast clause rolls BASE dice

**Verdict:** FAIL (upcast clause) — row FAILs on the authored Vitriolic Sphere "(level 5 version)" save-leg clause. All other legs PASS.

## Row
- id: MA-0160 | monster: Ancient Black Dragon (ancient-black-dragon) | action: Spellcasting
- Authored (public/data/monsters.json:3003 block): spell save DC 21, Charisma, +13 spell attacks; At Will: Detect Magic, Fear, Melf's Acid Arrow (level 4 version); 1/Day Each: Create Undead, Speak with Dead, Vitriolic Sphere (level 5 version)
- Data check PASS: `save_dc: 21`, `save_type: "Charisma"`, full list + both "(level N version)" clauses match the row exactly.

## Confirmed working (live, test-campaign, 2026-09-14)
- Spell list renders exactly: `.mc-dice-link-spell` links "Detect Magic", "Fear", "Melf's Acid Arrow", "Create Undead (1/Day · 1 left)", "Speak with Dead (1/Day · 1 left)", "Vitriolic Sphere (1/Day · 1 left)"; description renders verbatim incl. "spell save DC 21, +13 to hit".
- Save-forcing cast (Vitriolic Sphere) → sp-modal "ElderPaladin must make a DEX saving throw. DC 21"; `save_result` change-data + log {saveDc:21, saveType:"DEX", success:false}. DC 21 = 8 + CHA(+6) + PB(+7) confirms Charisma derivation.
- 1/Day gate fully enforced: spend log "1/Day use spent — 0 remaining today" at cast; change-data `monsterSpellUses {"Vitriolic Sphere":1}` on "Ancient Black Dragon 1"; counter flipped to "(1/Day · 0 left)"; re-click → `automation blocked` "already cast Vitriolic Sphere today (1/Day) — Vitriolic Sphere refused", uses stayed 1 (zero-spend).
- Damage applied on failed save: save-damage roll + `hp_change` ElderPaladin 100→74 (−26).
- Components: no component gate on monster cast path — "no Material components" clause trivially satisfied.
- "No damage on successful save" prompt is app-data-correct: 2024 spells.json Vitriolic Sphere `dc.dc_success:"none"` (§2 judge app data).

## FAIL clause — save-leg upcast rolls BASE dice
Live evidence (log, decisive):
```json
{"type":"roll","characterName":"Ancient Black Dragon 1","rollType":"save-damage","name":"Vitriolic Sphere","formula":"10d4","rolls":[2,2,3,1,4,2,4,2,4,2],"total":26,"damageType":"Acid","targetName":"ElderPaladin","finalDamage":26,"saveSuccess":false}
```
- Row authors "Vitriolic Sphere (level 5 version)" → expected 12d4 acid initial (2024 spells.json `damage.damage_at_slot_level`: `"4":"10d4", "5":"12d4"`).
- Cast rolled BASE `formula:"10d4"` — the "(level 5 version)" clause is ignored.
- Cause (static, unchanged since MA-0112/MA-0135): `executeMonsterSaveSpellCast` calls `spellDamageFormulaAtBaseLevel(spell)` (src/components/encounter/MonsterCardModal.jsx:640-641); `spellCastLevelFromSpellcasting` / `spellDamageFormulaAtLevel` are wired only on the spell-ATTACK branch (:588-590, MA-0033). Save-leg rows with authored upcast clauses roll base — known residual, now failing this row under the strict bar. (The row's other upcast clause, Melf's Acid Arrow lv4, is an attack-roll spell on the correctly-wired :590 branch.)

## Fix suggestion
In `executeMonsterSaveSpellCast` (MonsterCardModal.jsx:640) resolve cast level via existing `spellCastLevelFromSpellcasting(action.description, spellName, spell)` and pass `spellDamageFormulaAtLevel(spell, castLevel)` into `handleSaveRoll` — mirror the attack-branch wiring at :588-590.

## Evidence capture
Live Playwright run on http://localhost:5173, test-campaign, EB Join "Ancient Black Dragon 1" (hp 367, AC 22, cs idx 0, init 4), ElderPaladin armed via dragon-card `[data-testid="target-select"]` (targetName confirmed server-side), ElderPaladin HP stamped 100. Cleanup: Admin clear change-data + log on test-campaign only (API); manifest `verified` untouched.
