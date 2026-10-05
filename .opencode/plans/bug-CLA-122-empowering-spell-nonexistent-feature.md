# Bug CLA-122 — Empowering Spell: feature name absent from all app data; no handler/consumer — unimplementable

## Title
CLA-122 "Empowering Spell" (manifest: "reroll damage dice that roll 1 or 2" for Sorcerer spells, "name may vary in 2024 rules"). No such feature exists in any app data file and no code lane implements damage-dice 1-2 rerolls for sorcerers. The manifest row appears fabricated/hallucinated.

## Overview
Adjudicated statically 2026-10-04 (no UI affordance to test — nothing references the feature).

## Expected Behavior (manifest claim)
When you roll damage for a sorcerer spell with the "Empowering Spell" benefit, reroll damage dice showing 1 or 2; must use new rolls.

## Actual Behavior / Evidence
1. `rg -i "empowering" public/data/2024/classes.json public/data/classes.json public/data/2024/feats.json public/data/feats.json` → **zero hits** in all four data files.
2. Sorcerer (2024) complete feature set enumerated from `public/data/2024/classes.json`: BASE lv1-20 = Spellcasting, Innate Sorcery, Font of Magic, Metamagic, Sorcery Incarnate, Sorcerous Restoration, Arcane Apotheosis + ASI; MAJORS = Aberrant Sorcery, Clockwork Sorcery, Draconic Sorcery, Wild Magic Sorcery — none named or described as damage-dice reroll; no reroll/reroll-damage trigger anywhere in Sorcerer automation blocks.
3. Reroll lanes that DO exist in code are unrelated: `auto_reroll` modifier type (automationModifiers.js:29, save-reroll family: Barbarian Fearless/ :1152, Battle Master-style :4786, `:2037/:3062` feature blocks) and `reroll_healing_ones` (automationPassives.js:248 — Draconic-ish healing lane) — neither triggers on sorcerer spell damage 1s/2s.
4. Zero handlers: manifest's classFeatureHandler chain never receives an "empowering_spell" feature because no data declares it.
5. 2024 Essentials has no Sorcerer "Empowering Spell" in print either — row likely invented by manifest author.

## Steps to Reproduce
1. Open any 2024 Sorcerer sheet (e.g. AberrantSorcerer) → no "Empowering Spell" row on sheet Features/Special Actions.
2. Grep data files above → zero.

## Likely Location
- Not a code defect — a **manifest data defect**: delete or replace CLA-122 with a real feature (closest intents: Metamagic "Empower"? (absent in 2024) / Wild Magic "Bend Luck" reroll lane = CLA row exists separately / Draconic "Elemental Affinity" = CLA-110 filed).

## Notes
- Verified statically; no live test performed because there is no affordance or data-driven surface to click. Verified 2026-10-04.
