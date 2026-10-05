# Bug CLA-118 — Elfish Lineage: Speed 35 render-bypass, lv3/lv5 spells un-gated, wizard subrace never syncs runtime

## Title
Elfish Lineage (Elf racial): Wood Elf Speed 35 never reaches the sheet (grant lives on playerStats.speed, render reads race JSON); lineage ladder spells granted at ALL levels; wizard subrace edits leave the runtime lineage stale (Drow char keeps Wood Elf grants + 60 ft darkvision).

## Overview
Verified 2026-10-04 by creating ElfTest (Elf/Wood Elf Fighter lv1 via wizard) in test-campaign. Lineage chooser modal itself works (Drow/High Elf/Wood Elf → `_elfishLineageSelection/_Ability/_Cantrip/_Level3/_Level5` on disk; Druidcraft cast logs cleanly). Three defects make the trait's automations inert or wrong.

## Expected Behavior (races.json:386+ table)
- Wood Elf: Speed 35 ft + Druidcraft lv1 / Longstrider lv3 / Pass Without Trace lv5.
- Drow: Darkvision 120 + Dancing Lights lv1 / Faerie Fire lv3 / Darkness lv5.
- High Elf: Prestidigitation lv1 / Detect Magic lv3 / Misty Step lv5. Spells level-gated; sheet speed/senses reflect chosen lineage; wizard subrace change must update everything.

## Actual Behavior
1. Chooser PASS: modal "Choose your lineage:" → confirm → popup "Selected Wood Elf lineage. Spellcasting ability: Wisdom"; runtime keys persisted. Ability chosen by derivation from lineage data — no explicit INT/WIS/CHA selector (advisory).
2. FAIL(a) Speed: sheet Speed stays **30 ft.** after Wood Elf selection + reload. `applyElfisLineageSpeed()` (rules.js:550) returns **35** on `playerStats.speed`, but `charSummaryCalc.js getBaseSpeed()` (:43/:368) reads `race.subrace.speed || race.speed`; Wood Elf subrace JSON has no `speed` key → render-path bypass. (Control DwarfTest 30 ft Darkvision 120 correct.)
3. FAIL(b) gating: `applyLineageFeatureSpells` (spellCalc2024.js:166) adds lv3+lv5 spells UNCONDITIONALLY — lv1 Wood Elf shows Longstrider (1) + Pass Without Trace (2) rows.
4. FAIL(c) wizard sync: Edit wizard Wood→Drow persists `race.subrace=Drow`, spell rows swap correctly, BUT Senses stays "Darkvision 60 ft." (120 not applied — `resolveElfishLineage` reads `race.lineage` [never set by wizard] || stale `_elfishLineageSelection`), and trait click shows stale "Elfish Lineage: Wood Elf (already selected)" — runtime layer keeps granting Wood Elf benefits to a Drow.
5. Cast PASS: Druidcraft lv0 logged, no damage.

## Steps to Reproduce
1. test-campaign; create ElfTest Elf/Wood Elf Fighter lv1 (wizard).
2. Sheet → Special Actions "Elfish Lineage" → Wood Elf → reload → Speed line 30 ft (bug a); spell rows include lv3/lv5 at lv1 (bug b).
3. Edit wizard subrace → Drow → Save → Senses Darkvision 60 ft; re-open trait modal → "Wood Elf (already selected)" (bug c).

## Likely Location
- `src/services/rules/charSummaryCalc.js:43/368` getBaseSpeed — consume playerStats.speed (or lineage speed) instead of race JSON only.
- `src/services/rules/spellCalc2024.js:166` applyLineageFeatureSpells — gate by character level per ladder.
- `resolveElfishLineage` — fallback chain must prefer `race.subrace` when runtime `_elfishLineageSelection` absent; wizard must stamp runtime key on subrace change.

## Notes
- Two independent state channels: wizard writes `race.subrace`; sheet modal writes `_elfishLineageSelection*` runtime keys — GET both after any lineage change.
- ElfTest left in place (see registry). Verified 2026-10-04.
