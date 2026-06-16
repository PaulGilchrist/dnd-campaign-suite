import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export async function handle(action, playerStats, campaignName) {
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

    const companionAlive = getRuntimeValue(playerName, 'primalCompanionAlive', campaignName);
    if (companionAlive === false) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Primal companion is not alive.',
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'primalCompanionSpellShare',
        payload: {
            action,
            playerStats,
            campaignName,
            companionType,
        },
    };
}

export async function applySpellShare(action, playerStats, campaignName, share) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);

    if (!companionType) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No primal companion to share spell with.',
                automation: auto,
            },
        };
    }

    if (!share) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Spell not shared with primal companion.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, 'lastSpellShare', action.name, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `Spell shared with ${companionType}.`,
            automation: auto,
        },
    };
}
