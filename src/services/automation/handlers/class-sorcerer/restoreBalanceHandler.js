import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

export async function handle(action, playerStats, campaignName) {
    const featureName = action.name || 'Restore Balance';
    const playerName = playerStats.name;

    const chaMod = getAbilityModifier(playerStats.abilities, 'CHA');
    const usesMax = Math.max(1, chaMod);

    const usesKey = getRuntimeUsesKey(featureName);

    const currentUses = Number(getRuntimeValue(playerName, usesKey) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No uses remaining. Recharges on a Long Rest.`,
                automation: action.automation,
            },
        };
    }

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName}. The next d20 roll is without Advantage or Disadvantage. Uses: ${currentUses - 1}/${usesMax}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[restoreBalance] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `The next d20 roll is without Advantage or Disadvantage.`,
            automation: action.automation,
        },
    };
}
