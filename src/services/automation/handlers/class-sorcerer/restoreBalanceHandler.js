import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { armRestoreBalance, isRestoreBalanceArmed } from '../../../combat/restoreBalanceState.js';
import { getRuntimeUsesKey } from '../../../shared/usesKey.js';

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

    if (isRestoreBalanceArmed(playerName, campaignName)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} is already armed — the next d20 roll with Advantage or Disadvantage by a creature you can see within 60 feet will be a normal roll.`,
                automation: action.automation,
            },
        };
    }

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    await armRestoreBalance(playerName, Date.now(), campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} (Reaction). Armed: the next d20 roll with Advantage or Disadvantage by a creature you can see within 60 feet is without Advantage or Disadvantage. Uses: ${currentUses - 1}/${usesMax}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[restoreBalance] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName} armed: the next d20 roll with Advantage or Disadvantage by a creature you can see within 60 feet will be without Advantage or Disadvantage. Uses: ${currentUses - 1}/${usesMax}.`,
            automation: action.automation,
        },
    };
}
