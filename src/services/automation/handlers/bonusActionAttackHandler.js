import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { automationInfoPopup } from '../../shared/popupResponse.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;

    const usesMax = auto.usesMax ?? 0;

    if (usesMax > 0) {
        const usesKey = auto.resourceKey || 'warPriestUses';
        const usesUsed = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 0);
        if (usesUsed >= usesMax) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has no uses remaining. Recharges on a ${auto.recharge || 'Long Rest'}.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerStats.name, usesKey, usesUsed + 1, campaignName);
    }

    return automationInfoPopup(action);
}
