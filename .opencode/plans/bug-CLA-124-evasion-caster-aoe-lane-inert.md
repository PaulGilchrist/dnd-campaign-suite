# Bug CLA-124 — Evasion: caster-AoE prompt lane reads combatSummary computedStats (never populated) → fold inert; success still half, fail still full

## Title
Evasion (Monk lv7 2024 / lv14 5e): the core fold computeDamageAfterEvasion (applyDamage.js:122) is correct, and NPC lanes (saveProcessing.js:1438, handleNpcSaveDamage.js:633) wire it — but the PC caster-AoE prompt lane (SaveAttackAoeModal.jsx:380-383 resolveEvasionFinalDamage) reads `combatSummary.creatures[type=player].computedStats.evasionEffects`, which persisted change-data player entries never contain (only {concentration,currentHp,initiative,maxHp,name,targetName,type}) → evasionActive always false.

## Overview
Verified 2026-10-04, test-campaign. Casters: DivinationWizard lv20 Fireball DC19. Host Disciplined_Monk lv20 (DEX +7). Control DwarfTest lv3 (DEX +1, no Evasion). Control behaved RAW → test valid.

## Expected Behavior
vs DEX-save-half-damage effect: monk takes **0 on success, floor(raw/2) on failure**; not while Incapacitated.

## Actual Behavior
1. Cast1: monk FAIL 7+11=18 → raw 8d6=35 → finalDamage:35 FULL (expects 17).
2. Cast2: monk FAIL → raw 29 → −29 FULL (expects 14). Two fail samples.
3. Cast4: monk NATURAL SUCCESS 19 vs DC19 → UI "Saved — takes 18 Fire (halved)", finalDamage 18, hp −18 (expects **0**). Fold fully inert both branches.
4. Control DwarfTest FAIL 11 → full 29 (correct — lane works for normal chars).
5. No `rollType:'evasion'` log entry emitted despite Evasion note shown in prompt.
6. Root cause: SaveAttackAoeModal.jsx:380-383 wrong stats source (GET-verified entry keys lack computedStats).
7. Incapacitated guard grep-present in other lanes (SavePromptModal.jsx:44, useLoggedDiceRollSaves.js:97, saveProcessing.js:335, handleNpcSaveDamage.js:117) but ABSENT in resolveEvasionFinalDamage — must be added with fix. Advisory only.

## Steps to Reproduce
1. test-campaign; monk in Fireball AoE from wizard.
2. Save prompt → roll natural success → damage still half (bug); roll fail → damage still full (bug).

## Likely Location
- `SaveAttackAoeModal.jsx:380-383` — source evasion from full playerStats/rolled features (like saveProcessing.js:1438 lane does) instead of combatSummary stub computedStats; add Incapacitated guard to match other lanes.

## Notes
- PITFALL found: "Reroll Save (1 FP)" = Disciplined Survivor reroll logs finalDamage:null + zero damage → FALSE evasion-success sample; use natural saves only. HP bump via initiative spinner may not persist before next tick — GET-verify after bump. Admin cleared, GET-empty. Verified 2026-10-04.

## TWIN: CLA-125 (Rogue Evasion) — same root cause, verified 2026-10-04
AasimarTest lv20 Rogue/Assassin (DEX +8 vs DC19): SUCCESS nat 19+8=27 raw 31 → applied 15 "halved" (expects 0); 4 FAIL samples all FULL (31/24/32/44, expects floor/2); zero evasion ledger markers. Same SaveAttackAoeModal.jsx:380-385+1605-1620 combatSummary-stub lane; monster breath (MonsterCardModal.jsx:41) shares the broken modal. Control DwarfTest baseline correct. Both class rows blocked by this single defect.
