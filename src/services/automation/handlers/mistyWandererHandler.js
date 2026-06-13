import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { evaluateAutoExpression } from '../../combat/automationExpressions.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const featureName = action.name || 'Misty Wanderer';

    const usesMax = evaluateAutoExpression(auto.uses_expression || 'WIS modifier_min_1', playerStats) || 1;
    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerStats.name, freeCastCountKey, campaignName) ?? usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free casts remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'mistyWanderer',
        payload: {
            action,
            playerStats,
            campaignName,
            usesMax,
        },
    };
}

export async function confirmMistyWanderer(action, playerStats, campaignName, bringAlly, allyName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Misty Wanderer';

    const usesMax = evaluateAutoExpression(auto.uses_expression || 'WIS modifier_min_1', playerStats) || 1;
    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free casts remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    const newCount = currentCount - 1;
    await setRuntimeValue(playerName, freeCastCountKey, newCount, campaignName);

    let description = `${featureName}: Cast Misty Step (${newCount} remaining).`;

    if (bringAlly && allyName) {
        description += ` Brought ${allyName} to an unoccupied space within 5 feet of your destination.`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
            triggerMistyStep: true,
        },
    };
}
