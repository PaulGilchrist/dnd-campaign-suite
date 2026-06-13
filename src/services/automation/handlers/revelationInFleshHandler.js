import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getCurrentSorceryPoints, spendSorceryPoints } from '../../../hooks/useMetamagic.js';
import { getClassFeatures } from '../../../services/character/classFeatures.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const options = auto.options || [];

    if (options.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no options available.`,
                automation: auto,
            },
        };
    }

    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = getCurrentSorceryPoints(playerName, maxSP);

    if (currentSP <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: No Sorcery Points available. Cost: 1 SP.`,
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'revelationInFlesh',
        payload: { action, playerStats, campaignName },
    };
}

export async function applyRevelationOption(action, playerStats, campaignName, optionName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const option = auto.options?.find(o => o.name === optionName);

    if (!option) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Unknown option: ${optionName}`,
                automation: auto,
            },
        };
    }

    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = getCurrentSorceryPoints(playerName, maxSP);

    if (currentSP < 1) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No Sorcery Points available. Cost: 1 SP.`,
                automation: auto,
            },
        };
    }

    spendSorceryPoints(playerName, 1, campaignName);

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const existingIndex = activeBuffs.findIndex(b => b.name === action.name);

    const buffEntry = {
        name: action.name,
        effect: option.effect,
        duration: auto.duration || '10_minutes',
        hasAutomation: true,
    };

    let newBuffs;
    if (existingIndex >= 0) {
        newBuffs = [...activeBuffs];
        newBuffs[existingIndex] = buffEntry;
    } else {
        newBuffs = [...activeBuffs, buffEntry];
    }

    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    let description = `${action.name}: ${optionName} chosen.`;
    if (option.description) {
        description += ` ${option.description}.`;
    }
    description += ` (1 SP spent, duration: ${auto.duration || '10 minutes'})`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description,
            automation: auto,
        },
        logEntries: [{
            characterName: playerName,
            type: 'action',
            text: `${action.name}: ${optionName} (1 SP)`,
        }],
    };
}
