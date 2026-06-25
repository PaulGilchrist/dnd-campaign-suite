import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const usesKey = auto.resource || 'psionicEnergy';
    const defaultMax = playerStats.resources?.[usesKey]?.max || 6;
    const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? defaultMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No Psionic Energy remaining. Recharges on a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    const currentConditions = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
    const conditionsToRemove = [];
    if (Array.isArray(currentConditions)) {
        for (const c of currentConditions) {
            const lower = String(c).toLowerCase();
            if (lower === 'charmed' || lower === 'frightened') {
                conditionsToRemove.push(c);
            }
        }
    }

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    await setRuntimeValue(playerName, 'activeConditions', Array.isArray(currentConditions) ? currentConditions.filter(c => !conditionsToRemove.includes(c)) : [], campaignName);

    const removedList = conditionsToRemove.length > 0 ? conditionsToRemove.join(' and ') : 'none';

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to end ${removedList} conditions. Psionic Energy: ${currentUses - 1}/${defaultMax}.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: Ended ${removedList} conditions. Psionic Energy: ${currentUses - 1}/${defaultMax}.`,
            automation: auto,
        },
    };
}
