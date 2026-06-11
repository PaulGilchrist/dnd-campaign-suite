import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { automationInfoPopup } from '../../shared/popupResponse.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const usesMax = auto.uses || 1;
    const resourceKey = auto.resourceKey || 'actionsurgeUses';

    if (usesMax > 0) {
        const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? usesMax);
        if (usesUsed <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has no uses remaining. Recharges on a ${auto.recharge || 'Short Rest'}.`,
                    automation: auto,
                },
            };
        }
    }

    if (auto.oncePerTurn) {
        const usedThisTurn = getRuntimeValue(playerStats.name, 'actionsurgeUsedThisTurn', campaignName);
        if (usedThisTurn) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} can only be used once per turn.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerStats.name, 'actionsurgeUsedThisTurn', true, campaignName, true);
    }

    if (usesMax > 0) {
        const usesUsed = Number(getRuntimeValue(playerStats.name, resourceKey, campaignName) ?? usesMax);
        if (usesUsed > 0) {
            await setRuntimeValue(playerStats.name, resourceKey, usesUsed - 1, campaignName, true);
        }
    }

    return automationInfoPopup(action);
}
