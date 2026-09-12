import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadManeuvers } from '../../../ui/dataLoader.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { getAvailableAttackRiderManeuvers, getAvailableAttackRiderManeuversByTrigger } from './combatSuperiorityQueries.js';
import * as combatSuperiorityQueries from './combatSuperiorityQueries.js';
import {
    hasRelentless,
    getRelentlessUsedRound,
    getKnownManeuvers,
    getSuperiorityDice,
    computeMaxOptions,
    executeSweepingAttack,
} from './combatSuperiorityUtils.js';
import { executeAttackRiderManeuver } from './executeAttackRider.js';
import { executeBonusActionManeuver, executeGrantAttackManeuver, executeMovementManeuver, executeSkillCheckManeuver, executeReactionManeuver, executeCommandingPresenceReaction } from './executeActionManeuvers.js';
import { executeManeuver } from './executeManeuver.js';

// ── Main Handler (route to specific dispatchers) ────────────────────────

const REACTION_TYPE_DISPATCH = {
    grant_attack: handleCombatSuperiorityGrantAttack,
    commanding_presence: handleCombatSuperiorityCommandingPresenceReaction,
};

const ACTION_TYPE_DISPATCH = {
    bonus_action: handleCombatSuperiorityBonusAction,
    sweeping_attack: handleCombatSuperioritySweepingAttack,
    movement: handleCombatSuperiorityMovement,
    skill_check: handleCombatSuperioritySkillCheck,
};

const TRIGGER_DISPATCH = {
    attack_rider: 'handleAttackRiderPrompt',
    skill_check: 'handleSkillCheckPrompt',
};

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    if (auto?.maneuverName) {
        return executeManeuver(action, playerStats, campaignName, auto.maneuverName);
    }

    if (auto?.actionType === 'reaction') {
        const reactionHandler = REACTION_TYPE_DISPATCH[auto?.reactionType] || handleCombatSuperiorityReaction;
        return reactionHandler(action, playerStats, campaignName, _mapName);
    }

    const actionHandler = ACTION_TYPE_DISPATCH[auto?.actionType];
    if (actionHandler) {
        return actionHandler(action, playerStats, campaignName, _mapName);
    }

    const triggerHandlerName = auto?.trigger ? TRIGGER_DISPATCH[auto.trigger] : null;
    if (triggerHandlerName) {
        return combatSuperiorityQueries[triggerHandlerName](action, playerStats, campaignName, _mapName);
    }

    return showCombatSuperioritySelection(action, auto, playerStats, campaignName);
}

async function showCombatSuperioritySelection(action, auto, playerStats, campaignName) {
    const allManeuvers = await loadManeuvers(playerStats.rules || '2024');

    if (allManeuvers.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver data available.',
            },
        };
    }

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    if (superiorityDice <= 0 && !(relentless && !relentlessUsed)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Superiority Dice remaining. Recharges on a Short or Long Rest.',
            },
        };
    }

    const knownManeuvers = getKnownManeuvers(playerStats, campaignName);
    const availableForAction = allManeuvers.filter(m => knownManeuvers.includes(m.name));
    const forceSelectionMode = auto?.forceSelectionMode === true;
    const selectionMode = forceSelectionMode || knownManeuvers.length !== allManeuvers.length;

    return {
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: {
            action,
            playerStats,
            campaignName,
            allManeuvers,
            knownManeuvers: availableForAction.map(m => m.name),
            maxOptions: computeMaxOptions(playerStats, auto),
            selectionMode,
            saveDc: auto?.saveDc || 'ability',
            saveType: auto?.saveType || 'WIS',
            dieExpression: auto?.dieExpression || 'superiority_die',
        },
    };
}

// ── Modal Selection Handler ─────────────────────────────────────────────

const SELECTION_ACTION_DISPATCH = {
    skill_check: executeSkillCheckManeuver,
    grant_attack: executeGrantAttackManeuver,
    movement: executeMovementManeuver,
    reaction: executeReactionManeuver,
    bonus_action: executeBonusActionManeuver,
};

function selectionPopup(action, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
        },
    };
}

async function handleMultiManeuverSelection(action, playerStats, campaignName, selectedManeuverNames) {
    if (selectedManeuverNames.length === 0) {
        await setRuntimeValue(playerStats.name, 'BattleMasterManeuvers_selection', [], campaignName);
        return selectionPopup(action, 'Battle Master selection cleared.');
    }

    const allManeuvers = await loadManeuvers(playerStats.rules || '2024');
    const allNames = allManeuvers.map(m => m.name);
    const validManeuvers = selectedManeuverNames.filter(name => allNames.includes(name));

    await setRuntimeValue(playerStats.name, 'BattleMasterManeuvers_selection', validManeuvers, campaignName);

    if (validManeuvers.length === 0) {
        return selectionPopup(action, 'No valid maneuvers selected.');
    }
    return selectionPopup(action, `Maneuvers selected: ${validManeuvers.join(', ')}.`);
}

export async function onCombatSuperioritySelected(action, playerStats, campaignName, selectedManeuverNames, singleUseManeuverName) {
    const auto = action.automation || {};

    if (Array.isArray(selectedManeuverNames) && !singleUseManeuverName) {
        return handleMultiManeuverSelection(action, playerStats, campaignName, selectedManeuverNames);
    }

    const selectedName = singleUseManeuverName || (selectedManeuverNames && selectedManeuverNames[0]);

    if (!selectedName) {
        return selectionPopup(action, 'No maneuver selected.');
    }

    const stored = getRuntimeValue(playerStats.name, 'BattleMasterManeuvers_selection', campaignName);
    const knownManeuvers = Array.isArray(stored) ? stored : [];

    if (auto.singleUseManeuver === selectedName && !auto.isReload) {
        const newKnown = knownManeuvers.filter(n => n !== selectedName);
        await setRuntimeValue(playerStats.name, 'BattleMasterManeuvers_selection', newKnown, campaignName);
    }

    if (auto.actionType === 'attack_rider') {
        return executeAttackRiderManeuver(action, playerStats, campaignName, selectedName, auto.attackContext || null);
    }

    const executor = SELECTION_ACTION_DISPATCH[auto.actionType] || executeManeuver;
    return executor(action, playerStats, campaignName, selectedName);
}

// ── Attack Rider Options ────────────────────────────────────────────────

export async function getAttackRiderOptions(playerStats, campaignName, attackInfo) {
    const maneuvers = getAvailableAttackRiderManeuvers(playerStats, campaignName, attackInfo);
    return maneuvers.map(m => ({
        name: m.name,
        effect: m.effect || null,
        damageBonus: m.damageBonus || false,
        saveType: m.saveType || null,
        saveAbility: m.saveAbility || null,
        conditionInflicted: m.conditionInflicted || null,
        value: m.value || null,
        range: m.range || null,
        dieExpression: m.dieExpression || 'superiority_die',
    }));
}

export async function getAttackRiderOptionsByContext(playerStats, campaignName, attackInfo, context) {
    const maneuvers = getAvailableAttackRiderManeuversByTrigger(playerStats, campaignName, attackInfo);
    return maneuvers.map(m => ({
        name: m.name,
        dieExpression: m.dieExpression || 'superiority_die',
        trigger: m.trigger || 'any',
        actionType: m.actionType,
        context,
        saveType: m.saveType || null,
        saveDc: m.saveDc || null,
        saveAbility: m.saveAbility || null,
        conditionInflicted: m.conditionInflicted || null,
        value: m.value || null,
        range: m.range || null,
    }));
}

// ── Specific Action Dispatchers ─────────────────────────────────────────

export async function handleCombatSuperiorityBonusAction(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeBonusActionManeuver(action, playerStats, campaignName, maneuverName);
}

export async function handleCombatSuperiorityReaction(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeReactionManeuver(action, playerStats, campaignName, maneuverName);
}

export async function handleCombatSuperiorityGrantAttack(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeGrantAttackManeuver(action, playerStats, campaignName, maneuverName);
}

export async function handleCombatSuperioritySweepingAttack(action, playerStats, campaignName, _mapName) {
    const secondaryTargetName = action.automation?.secondaryTargetName;
    if (!secondaryTargetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Sweeping Attack: No secondary target selected.',
            },
        };
    }
    return executeSweepingAttack(action, playerStats, campaignName, secondaryTargetName);
}

export async function handleCombatSuperiorityMovement(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeMovementManeuver(action, playerStats, campaignName, maneuverName);
}

export async function handleCombatSuperioritySkillCheck(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeSkillCheckManeuver(action, playerStats, campaignName, maneuverName);
}

export async function handleCombatSuperiorityCommandingPresenceReaction(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeCommandingPresenceReaction(action, playerStats, campaignName, maneuverName);
}
