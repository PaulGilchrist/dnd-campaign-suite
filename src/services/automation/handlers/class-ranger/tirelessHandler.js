import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveDiceExpression } from '../../../combat/automation/automationExpressions.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Tireless';
    const resourceKey = auto.resourceKey || 'tirelessUses';

    const storedUses = getRuntimeValue(playerName, resourceKey, campaignName);
    const trackedMax = playerStats._trackedResources?.[resourceKey]?.current;
    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
    const maxUses = trackedMax ?? Math.max(wis?.bonus || 0, 1);
    const currentUses = storedUses != null ? Number(storedUses) : maxUses;

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} has no uses remaining. Regains all on a Long Rest.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, resourceKey, currentUses - 1, campaignName);

    const tempHpExpression = auto.tempHpExpression || '1d8 + WIS modifier';
    const processedExpression = resolveDiceExpression(tempHpExpression, playerStats);
    const rollResult = rollExpression(processedExpression);

    if (!rollResult || typeof rollResult.total !== 'number' || rollResult.total <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: Could not calculate temp HP (${tempHpExpression}).`,
                automation: auto,
            },
        };
    }

    const amount = rollResult.total;
    setRuntimeValue(playerName, 'tempHp', amount, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — gained ${amount} temporary hit points. Uses remaining: ${currentUses - 1}.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `<b>${featureName}</b><br/><br/>You push beyond your limits, gaining ${amount} temporary hit points.<br/><br/>Uses remaining: ${currentUses - 1}`,
            automation: auto,
        },
    };
}
