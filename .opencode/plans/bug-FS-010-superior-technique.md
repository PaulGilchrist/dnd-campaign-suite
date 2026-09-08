# BUG FS-010 — Superior Technique (fightingStyle, 2024) — FAIL

Testbed: EvasiveFighter lv18 2024 Fighter/Champion, Fighting Style set to Superior Technique via Edit wizard step 12 (persisted to disk `fightingStyles:["Superior Technique"]`). EB Thug 1 joined, target armed, real combat turns.

## Canonical expectation
"You learn one maneuver of your choice from the Battle Master. You can use your superiority dice to fuel that maneuver. Whenever you finish a short or long rest, you can choose a different maneuver to replace it." One d6 superiority die, refilled on short/long rest.

## What WORKS (live-verified)
- Grant: sheet "Combat Superiority:" special action + "Superiority Dice: 1/1" + "Superiority Die: d6".
  Consumers: `src/services/rules/rules-fightingStyles.js:199-218` (grant, dieExpression '6', uses_max 1);
  `src/services/rules/trackedResources.js:149-159` (non-Battle-Master Superior Technique Fighter → maxSD=1);
  `src/components/char-sheet/char-summary/CharClassFeatures.jsx:278-308` (d6 display, counter row).
- Maneuver chooser: clicking row opens CombatSuperiorityModal in selectionMode (all BM maneuvers, cap 1) — `src/services/automation/handlers/class-fighter-rogue/dispatchers.js:75-107`, `src/components/char-sheet/modals/CombatSuperiorityModal.jsx:84-85`. Confirmed persisted `BattleMasterManeuvers_selection:["Trip Attack"]`.
- Attack-rider prompt: after a HIT, pendingCombatSuperiorityPrompt (attackPostProcessing.js:120) → useCombatSuperiorityModal.js:195-234 dispatches `combat_superiority_attack_rider` → modal offers ONLY Trip Attack → tick + "Use Maneuver" → STR save DC 10 rolled on Thug 1 (`save_result` logged) → die spent 1→0 (`expendSuperiorityDie` combatSuperiorityUtils.js:109-113; ledger change-data confirmed 1→0).
- Exhaustion refusal at 0 dice: popup "No Superiority Dice remaining. Recharges on a Short or Long Rest." clean.
- Short rest refill: ledger 0→1/1 (restRules-constants.js:64 SHORT_REST_RESOURCES).
- Re-choose: modal swap Trip→Precision persisted (`BattleMasterManeuvers_selection:["Precision Attack"]`).

## FAILURES
1. **Wrong die face — d12 instead of d6 (x2 attacks).**
   Log: "Trip Attack: Rolled d12 for 6. Added 6 to the damage roll." twice.
   Root cause: attack-rider prompt fabricates `automation:{type:'combat_superiority', dieExpression:'superiority_die'}`
   (`combatSuperiorityQueries.js:140-144`), discarding the Superior Technique grant's `dieExpression:'6'`
   (rules-fightingStyles.js:209). `rollManeuverDie` (combatSuperiorityUtils.js:75) evaluates `superiority_die`
   via automationExpressions.js (`superiority_die` token → level-based Battle Master table; d12 at lv18).
   Fix: honor style dieExpression (or Superior-Technique-without-Battle-Master → 6) in
   combatSuperiorityQueries prompt payloads + evaluateAutoExpression fallback.
2. **Maneuver + base weapon damage never land on HP.**
   Two HITs (17 and 23 vs AC 11), rider "Added 6 to the damage roll", yet Thug 1 currentHp stayed 32,
   zero `damage`/`hp_change` log rows, `lastAttack.damageApplied:false`. Rider modal interrupts the
   hit-popup→damage-finalize chain (featureRiders stranding family, playbook §7). Popup-only "+6" is not an
   automation effect; per AGENTS.md every automation must land its effect + log.
3. **Post-short-rest phantom dice (ledger null → handler default 4).**
   Short rest sets runtime `superiorityDice:null` (SHORT_REST_RESOURCES). Sheet displays 1/1 via getMax fallback,
   but `getSuperiorityDice` defaults `?? 4` (combatSuperiorityUtils.js:40-44), so the first post-rest maneuver
   spent from 4 and wrote **superiorityDice=3** (live-verified). A pure Superior Technique user can therefore
   fuel up to 4 maneuvers per short rest. Fix: derive max from trackedResources/style (1), never default 4;
   short rest should restore to the character's actual max (1), not null.
4. Short Rest modal "Resources Restored" omits Superior Dice for Superior Technique fighters
   (`restRules-constants.js:22` label gated `subclasses:['Battle Master']`) — cosmetic gap.
5. Re-choose is "at any time" (modal text), not gated to short/long rest — advisory gap vs canonical; no
   rest-keyed chooser exists anywhere (grep: only this modal writes BattleMasterManeuvers_selection).

## Leftovers
- Stale "Shield Bash DC 15" save prompt + `save-damage` log on Thug 1 re-queued during every rider resolution
  (FT-074-era stale pendingSavePrompts; dismissed during session, may persist).
- EvasiveFighter now PERMANENTLY has fightingStyle Superior Technique; known maneuver = Precision Attack.
- Dice: automationRouter.js:241 routes combat_superiority; HANDLER_MAP automation/index.js:375.

CLEANUP: Admin cleared change-data + log, Thug token removed, server left running.
