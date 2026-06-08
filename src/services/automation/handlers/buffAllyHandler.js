import { toggleBuff } from '../common/buffToggle.js';
import { addExpiration } from '../../rules/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const maxUses = auto.usesMax ?? auto.uses ?? 0;
    if (maxUses > 0) {
        const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
        const usesUsed = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 0);
        if (usesUsed >= maxUses) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has been used and cannot be used again until a long rest.` +
                        (auto.recharge === 'long_rest_or_expend_rage' ? ' You may expend one use of Rage to restore it.' : ''),
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerStats.name, usesKey, usesUsed + 1, campaignName);
    }

    const { wasActive } = toggleBuff(
        playerStats.name,
        action.name,
        { ...auto, effect: auto.buffExpression || auto.effect },
        campaignName
    );

    if (!wasActive) {
        addExpiration(playerStats.name, playerStats.name, [
            { type: 'remove_active_buff', buffName: action.name }
        ], campaignName);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: wasActive
                ? `${action.name} expired`
                : `${action.name} activated — allies have Advantage on attack rolls and saving throws until the start of your next turn`,
            automation: auto,
        },
    };
}
