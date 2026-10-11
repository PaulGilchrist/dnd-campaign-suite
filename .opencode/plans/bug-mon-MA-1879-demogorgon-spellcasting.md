# MA-1879 — Demogorgon Spellcasting — plain-text description, zero spell chips (data)

## Title
Demogorgon Spellcasting row is inert: plain-text description fails the markup-only chip gate, so no spell chips render and the authored `save_dc:23/Wisdom` is unrenderable.

## Overview
Row MA-1879 (`demogorgon|actions|2`→actions[3]), actionType `spellcasting`, verified E2E localhost/test-campaign 2026-10-10. MA-1850 Archlich fingerprint reconfirmed: `Helpers.js:392` `extractSpellNamesFromSpellcasting` requires `<strong>/<em>` markup; plain text → [] → `SpellCastLinks` null (MonsterAction.jsx:83-84); `isSpellcastingRow` early-return leaves the row a dead prose block.

## Expected Behavior
Row description: "The demogorgon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23): At Will: Detect Magic, Major Image. 3/Day: Dispel Magic, Fear, Telekinesis. 1/Day: Feeblemind, Project Image."
Expected: DC 23 spell-save affordance renderable, castable spell chips for the 8 listed spells, 3/Day and 1/Day usage tokens enforced if authored in markup.

## Actual Behavior
- Spellcasting row: 0 chips; `.mc-dice-link-spell` = 0 card-wide (card otherwise live: Tentacle +17, Gaze DC 23 WIS, Expend Legendary ×2, Tail +17).
- Row press: zero clickable elements, zero popup, zero log delta (log stayed 2).
- Usage lane dead-by-construction: `extractSpellcastingSpellUses` (Helpers.js:431) is markup-only; plain-text "3/Day:"/"1/Day:" never parsed; `monsterSpellUses` never written.
- All 8 spells DO resolve in spells.json — fix is markup-only: wrap the description per MA-1848 shape and chips + per-spell usage counters arm.

## Steps to Reproduce
1. localhost → test-campaign → EB Demogorgon → Join Encounter → open card.
2. Observe Spellcasting row is plain prose; no spell chips anywhere on card.

## Likely Location
`public/data/monsters.json` — Demogorgon Spellcasting `description` lacks the `<strong>` markup other casters author (MA-1850 twin). No code change needed (chip gate by design, Helpers.js:392).

## Notes
- Authored `save_dc:23/save_type:"Wisdom"` exist but structurally unrenderable without chips (ability text says Charisma; save_type field Wisdom is the row's default-save label — verify on fix).
- Store-contamination pitfall found this run: whole-store `POST /change-data` is captured by `/:key` wildcard and stored under literal key `"change-data"`; use per-key routes.
