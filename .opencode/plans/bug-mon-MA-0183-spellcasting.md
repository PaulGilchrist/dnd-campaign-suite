# BUG MA-0183 — Ancient Brass Dragon Spellcasting: Scorching Ray uncastable (no spell_attack_bonus authored)

**Verdict:** FAIL — row carries a named At-Will **attack-roll spell** ("Scorching Ray (level 3 version)") that cannot be cast: click resolves to a refusal popup + `automation blocked` log with zero roll (MA-0065 fingerprint re-confirmed live on THIS row). All other legs work as PASS-subset facts below.

## Row
- id: MA-0183 | stableKey: ancient-brass-dragon|actions|4 | monster: Ancient Brass Dragon (ancient-brass-dragon) | actionIndex 4, actionType spellcasting
- Authored data (public/data/monsters.json, verified on disk this run): `save_dc: 20`, `save_type: "Charisma"`, description verbatim: At Will Detect Magic / Minor Illusion / Scorching Ray (level 3 version) / Shapechange (Beast or Humanoid, no THP, no Conc/THP maintain) / Speak with Animals; 1/Day Each Control Weather / Detect Thoughts. NO `spell_attack_bonus` key, NO "+N to hit" prose in description.
- Rig: test-campaign, EB join "Ancient Brass Dragon 1" cs idx0 hp 332 ac 20 (init 17 rolled), armed target AberrantSorcerer, gridless, header verified test-campaign.

## FAIL leg — Scorching Ray (At-Will attack spell)
Live click on `.mc-dice-link-spell` "Scorching Ray":
- Popup: "Spell Cast Refused — Ancient Brass Dragon 1 Scorching Ray: no spell attack bonus authored on the row. Nothing spent, no roll."
- Log (ts 1789451092078): `{"type":"automation blocked","characterName":"Ancient Brass Dragon 1","abilityName":"Scorching Ray","description":"... no spell attack bonus authored on the row. Zero spend, no roll."}`
- `GET /lastAttack` → `{"value":null}` — zero roll confirmed (only other log rolls that day were initiative at join, rollType:"initiative").
- Cause: `resolveSpellAttackPlan` (src/components/encounter/MonsterCardModal.jsx:678-688) requires `monsterSpellAttackBonus(action)` non-null; `monsterSpellAttackBonus` (MonsterCardHelpers.js:262-263) reads `action.spell_attack_bonus` OR prose `/\+\d+\s+to hit with spell attacks/i` — neither authored. Scorching Ray itself IS castable-shaped in 5e-first lookup (spells.json `attack_type:"ranged"` + `damage.damage_at_slot_level`), so the row is the sole gap — MA-0033/MA-0065 recipe exactly.
- Validation-before-spend works: refusal zero-spend, At-Will has no uses gate anyway.

## PASS-subset facts (live evidence, test-campaign 2026-09-15)
1. Row renders per-spell links + counters, enumerated verbatim (leading spaces per MA-0171): "​ Detect Magic", "​ Minor Illusion", "​ Scorching Ray", "​ Shapechange", "​ Concentration", "​ Temporary Hit Points", "​ Speak with Animals", "​ Control Weather (1/Day · 1 left)", "​ Detect Thoughts (1/Day · 1 left)" — 7 real spells all present (At Will 5 + 1/Day 2 ✓).
2. Fake-keyword cosmetic links CONFIRMED (MA-0091 family): "Concentration" and "Temporary Hit Points" render as `.mc-dice-link-spell` from `<strong>` prose tags — clickable, record-only noise.
3. Detect Thoughts (1/Day): click → spend live: change-data `monsterSpellUses {"Detect Thoughts":1}` on "Ancient Brass Dragon 1"; TWO ability_use lines (spend ts 1789451117389 + advisory ts 1789451117412 incl. "(spell save DC 20, Charisma)" + "Concentration (Up to 1 minute)") per MA-0171 two-line convention; counter flips "(1/Day · 0 left)"; re-click → `automation blocked` "already cast Detect Thoughts today (1/Day)" (ts 1789451131617), uses stay 1 (zero-spend) ✓.
   - NOTE vs orchestrator premise: app 5e spells.json Detect Thoughts carries NO structured `dc` and no damage → monster path takes the ADVISORY/record branch (MonsterCardModal.jsx:1189-1196), NOT a save prompt (`pendingSavePrompts` null, zero `saveResult-*` keys). Canonical WIS-save DC for DT is not modeled on the monster path; judge app data (§2).
4. Control Weather (1/Day): click → spend `monsterSpellUses {"Control Weather":1}` + advisory log "(spell save DC 20, Charisma). Concentration (Up to 8 hours)... GM-enforced"; NO weather/zone consumer state (targetEffects null, no weather keys) — §7 advisory ✓; re-click → `automation blocked` (ts 1789451153902) ✓.
5. Detect Magic (At-Will): advisory ability_use "casts Detect Magic via Spellcasting (spell save DC 20, Charisma). Concentration (Up to 10 minutes). Spell effect is recorded; GM-enforced for monsters." — NO uses key written (monsterSpellUses unchanged) ✓.
6. Shapechange (At-Will): click → advisory ability_use only (ts 1789451172093, same shape); combatSummary still 15 creatures (no new entity), no te, no polymorph state, no lastAttack. Honest citation: monster path has ZERO polymorph-entity producer — the polymorph/summon machinery (SummonSpiritModal/summonedCreatureService; True Polymorph SP-124) is PC-path only. Clause text "Beast or Humanoid form only, no THP" is wholly GM-advisory (CLA-325 precedent). Row link is a record-only affordance for Shapechange.

## Fix recipe (MA-0065 data-only, both sides)
Author on ancient-brass-dragon.actions[4]:
- `"spell_attack_bonus": 12` — DERIVED FROM DATA: ability_scores.cha = 22 → mod +6; proficiency_bonus = 6 (CR 20) → +6+6 = **+12** (monsters.json ancient-brass-dragon; orchestrator brief's "16" contradicts disk data; corroborated by authored save_dc 20 = 8+6+6).
- Prose fallback in description per MA-0065: add "+12 to hit with spell attacks" to the row text (both sides required for the fixed-row convention).
- Expected post-fix behavior: Scorching Ray click → attack seam roll d20+12 vs armed AC, formula per 5e spells.json `damage_at_slot_level` = **"2d6" Fire at lv3** (app data does not scale ray count; lv3 "version" = 2d6 per ray, multi-ray = one click per ray, no multi-roll producer MA-0065).
- Optional cosmetic (MA-0091): stop extractSpellNamesFromSpellcasting harvesting non-spell `<strong>` keywords ("Concentration", "Temporary Hit Points") into fake spell links.

## Cleanup
Admin clear change-data + log via localhost endpoints (Host: localhost), verified `{}` / `[]` ~15s quiet after hard reload; server left up. No manifest/playbook/registry edits by subagent.
