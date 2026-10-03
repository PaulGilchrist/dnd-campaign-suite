# Bug SP-015 — Bestial Spirit (summon_spirit) — VERIFIED: FAIL (2026-10-03)

Campaign: test-campaign · Host: Wild_Sage_Druid (Human, Druid/Circle of the Sea, lv20, 2024)
Cast path only (caster PC casts → caster-merged combatant spawns). EB-direct inert copies NOT counted (MA-0286).

## Expected (public/data/2024/spells.json index "bestial-spirit", level 2, Action, Concentration 1h, automation.type summon_spirit, baseLevel 2, hpPerLevelAbove 5)
- AC = 11 + spell's level
- HP 20 (Air) / 30 (Land, Water) + 5 per level above 2
- Speed 30 ft. base, + Climb 30 (Land), + Fly 60 (Air), + Swim 30 (Water)

## DEFECT 1 — AC never gains spell level (cast path, every cast)
- LAND lv2: merged init card + MonsterCardModal show **Armor Class 11**; expected 13 (11+2).
- AIR lv2: **Armor Class 11**; expected 13.
- Persisted cs: `Bestial Spirit (Land) 1 ac:11`, `Bestial Spirit (Air) 1 ac:11`.
- Root cause: `src/services/automation/handlers/spells/summonSpiritHandler.js` `buildSpiritCreature()` (~:130-136): `ac = monster.armor_class` flat. monsters.json `bestial-spirit-*` blocks store `armor_class: 11` as the *base* for "AC equals 11 + spell's level" — handler adds nothing. SP-114 comment ("AC is always the base armor_class … never slot-scaled") is canon for Summon Aberration-style blocks but wrong for Bestial Spirit; tests at `summonSpiritHandler.test.js:243/272` pin ac=11 and enshrine the defect.
- At lv3 expected AC 14 (11+3) would be 11 — off by the spell level at all levels.

## DEFECT 2 — Air variant missing base walk speed
- AIR card Speed row: **"fly 60 ft."** only; expected "Speed is 30 feet, … Fly 60 feet".
- cs: `speed: {"fly":"60 ft."}`. Root cause: DATA `monsters.json` `bestial-spirit-air.speed` lacks `walk:"30 ft."` (LAND/WATER blocks correctly carry walk 30).

## DEFECT 3 (adjacent) — upcast ladder unreachable from cast UI
- SpellDetailPopup `computeIsUpcastable` (:66-70) gates the upcast radio on damage/heal/`upcast_at_slot_level` — Bestial Spirit has none (HP ladder lives in `automation.hpPerLevelAbove`) → no "Cast at Level" selector renders; sheet popup shows only "Slots Remaining: n slot(s)".
- Live proof: 3 casts burned lv2 only (runtime `spell_slots_level_2` 3→0; `spell_slots_level_3` untouched 3). `resolveSummonedHp` HP ladder is implemented but the cast lane can never select lv3+, so "+5 per level above 2" is unverifiable via UI and untestable — summon upcast parity gap with damage spells.

## PASSING legs (recorded, strict-evidence)
- Variant chooser (.sp-overlay "Choose the form…") after Cast Spell, single-pick, Summon gated on selection ✓
- Spawn lands in cs at caster-initiative−0.1 (init 7.9/9.9; Bandit 1 init 12 present) ✓
- HP exact: LAND 30/30 lv2, AIR 20/20 lv2 ✓
- LAND Speed: walk 30 ft., climb 30 ft.; no fly/swim ✓
- Concentration tracked: caster cs entry `concentration {spell:"Bestial Spirit", dc:17}` + sheet badge "Bestial Spirit DC 17" + `pendingExpirations remove_summoned_creatures` expiryRounds 600 (1h) ✓
- te marker `summoned` (source Wild_Sage_Druid, summonSource spell, duration concentration) ×2 ✓
- Slot economy: lv2 popup "3 slots"→"2"→"1"; runtime 3→2→1→0 ✓
- Logs: "Wild_Sage_Druid casts Bestial Spirit (slot level 2), summoning Bestial Spirit (Land) (30/30 HP)." / "(Air) (20/20 HP)" — zero-delta never observed ✓

## Recipes (reuse)
- Wizard step-14 add prepared spell: Edit → "14 Spells" → `.list-item-checkbox` trigger div `el.click()` (verify className gains `checked`) → any `.mi-skip-btn` loop → Save.
- EB join: Encounters → search exact → `input[aria-label="Select Bandit"]` native `.click()` in evaluate → `button:has-text("Join Encounter")` appears only post-check.
- Merged card read: click initiative avatar img → modal Armor Class/Hit Points/Speed rows.
- Upcast for summon_spirit: NO affordance (see Defect 3) — do not hunt for radio.

## Cleanup performed
- Admin native UI cleared change-data + log (confirmed via route results).
- Permanent edit retained: druid spells[] 18→19 ("Bestial Spirit" prepared, wizard step-14).
- Bandit 1 + both spirits removed with combatSummary clear.
