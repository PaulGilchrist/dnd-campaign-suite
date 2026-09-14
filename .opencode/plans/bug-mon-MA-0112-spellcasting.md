# BUG MA-0112 — Adult Green Dragon Spellcasting: "(level 3 version)" upcast clause rolls BASE dice

**Verdict:** FAIL (upcast clause) — row FAILs on the authored Mind Spike upcast clause. All other legs PASS.

## Row
- id: MA-0112 | monster: Adult Green Dragon (adult-green-dragon) | action: Spellcasting
- Authored: spell save DC 17, Charisma; At Will: Detect Magic, Mind Spike (level 3 version); 1/Day: Geas

## Confirmed working (live, test-campaign, 2026-09-14)
- Spell list renders exactly: `.mc-dice-link-spell` links "Detect Magic", "Mind Spike", "Geas (1/Day · 1 left)" with "At Will:" header.
- Save-forcing spell (Mind Spike) → save prompt "ElderPaladin must make a WIS saving throw. DC 17"; change-data/log `save_result` saveDc:17, saveType WIS (spell's own dc_type per MA-0091 standard). DC 17 = 8 + CHA(+4) + PB(+5) confirms Charisma derivation.
- Casting ability in advisory log: Detect Magic click logs "casts Detect Magic via Spellcasting (spell save DC 17, Charisma)" (MA-0091 bar met).
- 1/Day gate (Geas) fully enforced: spend log "1/Day use spent — 0 remaining today", change-data `monsterSpellUses {"Geas":1}` on "Adult Green Dragon 1" key, counter flips to "(1/Day · 0 left)", re-click → `automation blocked` "already cast Geas today (1/Day) — Geas refused", uses stay 1 (zero-spend).
- At-Will clicks: advisory `ability_use` log only, no uses key written (monsterSpellUses stayed {Geas:1}).
- Static: same fingerprint as MA-0091 residual documented in playbook (MonsterCardModal.jsx:641 `spellDamageFormulaAtBaseLevel` on save-leg; `spellCastLevelFromSpellcasting` wired only on attack branch :590).

## FAIL clause — upcast mis-resolves
Live evidence (log, decisive):
```json
{"type":"roll","characterName":"Adult Green Dragon 1","rollType":"save-damage","name":"Mind Spike","formula":"3d8","rolls":[4,5,4],"total":13,"damageType":"Psychic","targetName":"ElderPaladin","finalDamage":6,"saveSuccess":false}
```
- Row authors "Mind Spike (level 3 version)" → expected 4d8 psychic (base 3d8 + 1d8 per slot above 2).
- Every cast rolled BASE `formula:"3d8"` — all three casts (2 success-half, 1 fail-full) used base dice. The "(level N version)" clause is ignored.
- Cause (static): `executeMonsterSaveSpellCast` uses `spellDamageFormulaAtBaseLevel(spell)` (src/components/encounter/MonsterCardModal.jsx:641); `spellCastLevelFromSpellcasting` / `spellDamageFormulaAtLevel` are wired only on the spell-ATTACK branch (:590, MA-0033). Save-leg rows with authored upcast clauses roll base — same known residual as MA-0091 (Adult Copper Dragon), now failing this row under the strict bar.

## Secondary observations (cosmetic / notes)
- Geas cast produced TWO `ability_use` logs for one click (duplicated advisory line, 42k family); second includes truncated "Spell eff…" tail text.
- Geas advisory log prints "(spell save DC 17, WIS)" — spell's dc_type in the ability slot rather than casting ability Charisma (Charisma correctly appears on the Detect Magic advisory). Cosmetic inconsistency in advisory text.
- Geas (save, no damage) resolves as advisory with no save prompt — accepted CLA-325/MA-0003 non-damage model, noted not counted against.
- Mind Spike dc_success 'half' in app 2024 data — half-on-success application is app-data-correct (§2), not a bug.

## Fix suggestion
In `executeMonsterSaveSpellCast` (MonsterCardModal.jsx:641) parse cast level via existing `spellCastLevelFromSpellcasting(action.description, spellName, spell)` and roll `spellDamageFormulaAtLevel(spell, castLevel)` — mirror the attack-branch wiring at :590.

## Evidence capture
Live Playwright run on http://localhost:5173, test-campaign, EB Join "Adult Green Dragon 1" (hp 207, AC 19, cs idx 0), target ElderPaladin armed (HP stamped 100 via combatSummary POST). Cleanup: Admin clear change-data + log on test-campaign only; manifest `verified` untouched.
