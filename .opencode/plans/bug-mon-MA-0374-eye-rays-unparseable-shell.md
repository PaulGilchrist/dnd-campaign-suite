# BUG MA-0374 — Beholder Eye Rays: save-only shell, zero ray resolution

**Verdict: FAIL** (MA-0352 bar: advertised damage/conditions never applied ≠ "GM-adjudication shelter"; §531 covers count/selection, NOT silent zero of parseable-by-design core numbers.)

## Row
- monster Beholder (monsterIndex beholder), actionIndex 2, "Eye Rays", aoe-save
- save_dc 16, save_type "Varies (Wisdom, Constitution, Strength, Dexterity)"
- damage_dice_primary "3d8, 4d6, 4d8, 3d8, 8d8, 10d10" (multi-string, unrollable as a single formula)

## Data dump (public/data/monsters.json actions[2])
Keys: name, description, save_dc, save_type, save_effect, damage_dice_primary, damage_type_primary.
NO rays array, NO per-ray structured automation, NO picker data. The 10 rays (Charm 3d8 Psychic+Charmed, Paralysis, Fear 4d6, Slow 4d8, Enervation 3d8 Poison, Telekinetic, Sleep, Petrify, Disintegrate 8d8 Force, Death 10d10) exist ONLY in prose.

## Grep cite — no picker/d10 consumer exists
- `rg -il "eye ?rays|rayPicker|randomRay|rollRay|beholder" src server` → zero pipeline consumers (only roarService/spellDamage prose comments).
- Path: MonsterAction.jsx:87 ActionSaveRoll → MonsterCardModal.jsx:1214 handleSaveRoll → MonsterCardModal.jsx:222 executeBlockSaveRoll.
- MonsterCardModal.jsx:226 `saveType = ... || action.save_type` forwarded verbatim; :247 `saveAbilityAbbr(saveType)`; MonsterCardHelpers.js:16 `saveAbilityAbbr` falls back to `substring(0,3).toUpperCase()` → **"VAR"**; MonsterCardHelpers.js:306 `toAbbr` → **"var"**; MonsterCardHelpers.js:311 `getCreatureSaveModifier` miss on key "var" → **0**. No d10 ray-roll call anywhere on this path.

## Live null-proof (test-campaign, header verified; localhost:5173; 3 fires, 3 different armed targets)
Chip renders only `DC 16 Varies (Wisdom, Constitution, Strength, Dexterity)` — no dice chip (multi-string fails canRollExpression).

| Fire | armed target | prompt ability | roll | result | ray damage? | condition? | d10 ray roll? |
|------|-------------|----------------|------|--------|-------------|------------|----------------|
| 1 | HexWarlock | "VARIES (WISDOM, CONSTITUTION, STRENGTH, DEXTERITY)" verbatim | d20 6 + 0 | FAIL vs 16 | none | none | none |
| 2 | ElderPaladin | same verbatim | d20 6 + 5 (+5 aura only) | FAIL vs 16 | none | none | none |
| 3 | LightfootHalfling | same verbatim | d20 14 + 0 | FAIL vs 16 | none | none | none |

- Popup never names a ray; never shows per-ray dice/condition; "Half damage on successful save" advertised yet no damage formula ever rolled/applied.
- curl change-data after fires: combatSummary HP unchanged for all three targets; no targetEffects/activeConditions on any of them; Beholder 1 runtime only stores lastSaveRoll with saveType "Varies (...)".
- curl log: only save rolls named **"VAR"** (monster-side) / "Eye Rays" (target-side), zero damage entries, zero condition entries, zero d10 picker rolls.

## Conclusion
Ability selection is an arbitrary hardcoded substring fallback ("VAR"/"var"), save modifier silently 0, and NONE of the 10 rays' advertised damage or conditions ever lands — no picker, no per-ray structured effects. Save-only shell. Fix requires structured rays array in monsters.json + a d10 picker consumer granting per-ray save/damage/condition legs.
