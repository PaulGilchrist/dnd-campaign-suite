import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';

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
                description: `${action.name}: No Sorcery Points available. Cost: 1 SP per selection.`,
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

export async function applyRevelationOptions(action, playerStats, campaignName, selectedOptions) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const options = auto.options || [];
    const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
    const currentSP = getCurrentSorceryPoints(playerName, maxSP);

    const validOptions = selectedOptions.filter(optName => options.some(o => o.name === optName));

    if (validOptions.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No valid options selected.',
                automation: auto,
            },
        };
    }

    if (currentSP < validOptions.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Not enough Sorcery Points. Need ${validOptions.length}, have ${currentSP}.`,
                automation: auto,
            },
        };
    }

    const spPool = getRuntimeValue(playerName, 'sorceryPoints');
    const spMax = maxSP;
    const spCurrent = spPool != null ? Number(spPool) : spMax;
    const newSP = Math.max(0, spCurrent - validOptions.length);
    await setRuntimeValue(playerName, 'sorceryPoints', newSP, campaignName);
    window.dispatchEvent(new CustomEvent('sorcery-points-updated'));

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];

    const filteredBuffs = activeBuffs.filter(b => b.name !== action.name);

    const duration = auto.duration || '10_minutes';
    const newBuffs = filteredBuffs.map(b => ({ ...b }));

    const logEntries = [];

    for (const optionName of validOptions) {
        const option = options.find(o => o.name === optionName);
        if (!option) continue;

        newBuffs.push({
            name: action.name,
            effect: option.effect,
            duration,
            hasAutomation: true,
        });

        logEntries.push({
            characterName: playerName,
            type: 'ability_use',
            abilityName: action.name,
            description: `${optionName} chosen. (1 SP spent, duration: ${duration.replace(/_/g, ' ')})`,
        });
    }

    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    const description = `${action.name}: ${validOptions.join(', ')} chosen. (${validOptions.length} SP spent, duration: ${duration.replace(/_/g, ' ')})`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description,
            automation: auto,
        },
        logEntries,
    };
}
