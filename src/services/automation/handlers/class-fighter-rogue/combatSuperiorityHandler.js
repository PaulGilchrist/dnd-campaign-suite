// combatSuperiorityHandler.js — Thin re-export layer for backward compatibility.
// All logic has been extracted into focused modules:
//   dispatchers.js          — handle(), onCombatSuperioritySelected(), getAttackRiderOptions*(), specific action dispatchers
//   executeManeuver.js      — executeManeuver(), validateSizeLimit()
//   executeAttackRider.js   — executeAttackRiderManeuver()
//   executeActionManeuvers.js — executeBonusActionManeuver, executeGrantAttackManeuver, executeMovementManeuver, executeSkillCheckManeuver, executeReactionManeuver, executeCommandingPresenceReaction
//   combatSuperiorityUtils.js — shared utilities (applyConditionToTarget, hasRelentless, rollManeuverDie, etc.)
//   combatSuperiorityQueries.js — maneuver filtering/querying, attack rider / skill check prompts

// Re-export dispatchers (main entry point + modal selection + attack rider options + action-specific dispatchers)
export {
    handle,
    onCombatSuperioritySelected,
    getAttackRiderOptions,
    getAttackRiderOptionsByContext,
    handleCombatSuperiorityBonusAction,
    handleCombatSuperiorityReaction,
    handleCombatSuperiorityGrantAttack,
    handleCombatSuperioritySweepingAttack,
    handleCombatSuperiorityMovement,
    handleCombatSuperioritySkillCheck,
    handleCombatSuperiorityCommandingPresenceReaction,
} from './dispatchers.js';

// Re-export execute functions
export {
    executeManeuver,
    validateSizeLimit,
} from './executeManeuver.js';

export {
    executeAttackRiderManeuver,
    applyManeuveringAllyGrant,
} from './executeAttackRider.js';

export {
    executeBonusActionManeuver,
    executeGrantAttackManeuver,
    executeMovementManeuver,
    executeSkillCheckManeuver,
    executeReactionManeuver,
    executeCommandingPresenceReaction,
} from './executeActionManeuvers.js';

// Re-export utils for consumers that import them directly
export {
    applyConditionToTarget,
    hasRelentless,
    getRelentlessUsedRound,
    setRelentlessUsed,
    getKnownManeuvers,
    getSuperiorityDice,
    computeMaxOptions,
    rollManeuverDie,
    executeBaitAndSwitchChoice,
    executeCommanderStrikeChoice,
    applyCommanderStrikeTurnEnd,
    executeRallyChoice,
    executeSweepingAttack,
} from './combatSuperiorityUtils.js';

// Re-export queries for consumers that import them directly
export {
    getManeuversForRules,
    getManeuversByType,
    getAvailableAttackRiderManeuvers,
    getAvailableAttackRiderManeuversByTrigger,
    getAvailableSkillCheckManeuvers,
    getSkillCheckManeuversForSkill,
    handleAttackRiderPrompt,
    handleSkillCheckPrompt,
} from './combatSuperiorityQueries.js';
