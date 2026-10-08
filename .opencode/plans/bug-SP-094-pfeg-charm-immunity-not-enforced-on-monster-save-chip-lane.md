# bug-SP-094-pfeg-charm-immunity-not-enforced-on-monster-save-chip-lane.md

SP-094 Protection from Evil and Good (2024 lv1) live verification 2026-10-08, test-campaign.

## Repro (live)
1. War_Cleric self-casts PFEG (lv1 slot 4→3, holy water consumed, te + cs.concentration + ability_use log exact).
2. War_Cleric concentration save fails (d20 4+2=6 vs DC10) → buff cleanly strips (te [], conc null) — recast OK.
3. With PFEG ACTIVE (te `protection_from_evil_and_good` target War_Cleric, cs.concentration {spell,dc:10}): Succubus 1 (Fiend) Charm chip DC15 Cha → PC prompt → SAVE FAILURE (8+6=14 vs 15, saveResult mode:normal).
4. Result: `condition applied` Charmed src Succubus 1 + change-data `War_Cleric.activeConditions:["charmed"]`. NO immunity, NO block log.

## Expected (RAW/spells.json 2024)
Protected target can't gain Charmed/Frightened from warded types (Fiend included).

## Root cause (code)
- `automationImmunities.js:54 isWardedConditionImmunity` REQUIRES `sourceCreatureType`.
- The monster-save-chip → PC-prompt fail lane runs `saveProcessing.js applyFailedSaveConditions` (:1089-1099) which calls `playerIsImmuneToCondition` WITHOUT `sourceCreatureType` → immunity inert → charm lands (:1101+ write).
- `conditionSaveService.js:142` also omits it.
- SEAMS that DO supply it: `useLoggedDiceRollEventHandlers.js:95/139` (`applyFailedSaveStatusEffects`, attackerCreature→resolveCreatureType) — but its producer `pending.statusEffects` (registerPendingSavePrompt callers: handlePlayerSaveDamage player-cast lane, wrathOfTheSea, radianceOfDawn) never carries a MONSTER save-chip charm → live-unreachable for the intended case. `handleNpcSaveDamage.js:240` = NPC victims only.
- Hit-clause lane `handlePlainDamage.js applyHitClauseConditions` = zero immunity check (Githzerai Psion Psychic Warp charmed-on-hit twin would also bypass).
- Fix template: thread attackerCreature/sourceCreatureType (combatSummary lookup by context.attackerName) into applyFailedSaveConditions' playerIsImmuneToCondition call + block log `automation blocked`; mirror handleNpcSaveDamage.js:240. Byte-inert when attacker type null.

## Secondary (known-family, same spell)
`protectionFromEvilAndGoodHandler.js activateProtection` (:86 toggleBuff, :117 warded key) fires un-awaited per-char writes same tick → server change-data drops the earlier activeBuffs write (§39/MA-0809 snapshot-race). Observed twice: activeBuffs missing server-side after both casts while wardedTypes/te/concentration landed. Runtime memory still applies effects (disadvantage folds work) but a reload/resync loses the buff state. Fix = merged full-store write.

## What WORKS (live verified)
- Leg A: Cambion (Fiend) Claw vs buffed PC: log `mode:"disadvantage"` rolls [18,18]→18+7 = 25 vs AC12, popup "Disadv (conditions)". Control Bandit (Humanoid) same buffed target: `mode:"normal"` rolls [19,4]. Type-gated fold `MonsterCardModal.jsx:863 applyProtectionFromEvilPenalty` live.
- Concentration: cs.concentration stamp, DC10 damage-triggered checks (fail→clean strip incl. activeBuffs [] resurrect, maintain→persist).
- lv1 slot spend, material gate enforcement (cast blocked without Flask of Holy Water (25 gp)), material_consumed log, popup target picker incl. self, duration metadata, expiry anchor model (expireOnCreatureName, rounds Infinity).

## Leg C (advantage on new saves vs effect that already charmed/frightened by warded type)
grep-zero consumer app-wide (only attack-disadvantage folds + te description prose targetEffectDefinitions.js:555). CODE-VERIFIED GAP — no producer/consumer; not live-reachable as distinct proof surface.

## Possession clause
Comment automationImmunities.js:52-53 "tracked as special state — handled separately"; zero possession consumer app-wide. Advisory-unbuilt (§70 family).
