import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionKey = 'primalCompanionType';
    const stored = getRuntimeValue(playerName, companionKey, campaignName);

    if (!stored) {
        return {
            type: 'modal',
            modalName: 'primalCompanionSummon',
            payload: { action, playerStats, campaignName },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${stored} companion is active.`,
            automation: auto,
        },
    };
}

export async function handleSummon(action, playerStats, campaignName, selectedType) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (!selectedType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No companion type selected.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, 'primalCompanionType', selectedType, campaignName);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${selectedType} summoned and active.`,
            automation: auto,
        },
    };
}

export async function handleCommand(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);
    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion summoned.',
                automation: auto,
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: Commanded ${companionType} to use Beast's Strike.`,
            automation: auto,
        },
    };
}

export async function handleRestore(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);
    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion to restore.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, 'primalCompanionAlive', true, campaignName);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${companionType} restored with full HP after 1 minute.`,
            automation: auto,
        },
    };
}

export async function handleBonusActionCommand(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);
    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion to command.',
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'primalCompanionBonusActionCommand',
        payload: {
            action,
            playerStats,
            campaignName,
            companionType,
        },
    };
}

const BONUS_ACTION_COMMANDS = [
    { name: 'Dash', description: 'Double movement speed this turn' },
    { name: 'Disengage', description: 'Movement doesn\'t trigger opportunity attacks' },
    { name: 'Dodge', description: 'Attackers have disadvantage against the companion' },
    { name: 'Help', description: 'Next ally attack against a target has advantage' },
];

export async function applyBonusActionCommand(action, playerStats, campaignName, selectedAction, useForceDamage) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);

    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion to command.',
                automation: auto,
            },
        };
    }

    const commandAction = BONUS_ACTION_COMMANDS.find(c => c.name === selectedAction);
    if (!commandAction) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No action selected.',
                automation: auto,
            },
        };
    }

    let message = `${action.name}: Commanded ${companionType} to take a ${selectedAction} action as a Bonus Action.`;
    if (useForceDamage && auto.forceDamageOption) {
        message += ` Companion deals Force damage instead of its normal damage type.`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: message,
            automation: auto,
        },
    };
}
