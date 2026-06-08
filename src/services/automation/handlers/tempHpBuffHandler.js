import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { evaluateAutoExpression } from '../../combat/automationService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const tempHpExpression = auto.tempHpExpression || '';
    if (!tempHpExpression) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: No temp HP expression defined.`,
                automation: auto,
            },
        };
    }

    const amount = evaluateAutoExpression(tempHpExpression, playerStats);
    if (typeof amount !== 'number' || amount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: Could not calculate temp HP (${tempHpExpression}).`,
                automation: auto,
            },
        };
    }

    setRuntimeValue(playerName, 'tempHp', amount, campaignName);

    let description = `Gained ${amount} temporary hit points from ${action.name}.`;
    if (auto.ongoingHealingExpression) {
        description += ` At the start of each turn while raging, can grant temp HP to a creature within ${auto.healingRange || '10 ft'}.`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description,
            automation: auto,
        },
    };
}

export function grantTempHpOnRage(action, playerStats, campaignName) {
    const auto = action.automation;
    if (!auto.triggerOnRage) return false;

    const tempHpExpression = auto.tempHpExpression || '';
    if (!tempHpExpression) return false;

    const amount = evaluateAutoExpression(tempHpExpression, playerStats);
    if (typeof amount !== 'number' || amount <= 0) return false;

    const existing = getRuntimeValue(playerStats.name, 'tempHp', campaignName) || 0;
    const newTotal = Math.max(existing, amount);
    setRuntimeValue(playerStats.name, 'tempHp', newTotal, campaignName);

    return true;
}
