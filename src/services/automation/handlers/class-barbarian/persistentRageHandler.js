import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const rageCount = classLevel?.rages || 0;

    if (rageCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No rage uses available at this level.`,
                automation: action.automation,
            },
        };
    }

    const currentRage = Number(getRuntimeValue(playerStats.name, 'ragePoints', campaignName) ?? rageCount);
    if (currentRage >= rageCount) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Rage points already at maximum (${currentRage}/${rageCount}).`,
                automation: action.automation,
            },
        };
    }

    const usedKey = 'persistentRageUsed';
    const alreadyUsed = getRuntimeValue(playerStats.name, usedKey, campaignName) === true;
    if (alreadyUsed) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Already used. Requires a Long Rest to reset.`,
                automation: action.automation,
            },
        };
    }

    await setRuntimeValue(playerStats.name, 'ragePoints', rageCount, campaignName);
    await setRuntimeValue(playerStats.name, usedKey, true, campaignName);

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} used ${action.name} to restore all rage points (${currentRage} -> ${rageCount}). This feature requires a Long Rest to reset.`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Rage points restored to ${rageCount}/${rageCount}.`,
            automation: action.automation,
        },
    };
}
