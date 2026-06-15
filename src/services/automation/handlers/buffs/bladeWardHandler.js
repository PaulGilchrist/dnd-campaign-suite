import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const buffName = action.name;

    const { wasActive } = toggleBuff(
        playerName,
        buffName,
        { ...auto, effect: 'blade_ward' },
        campaignName
    );

    if (!wasActive) {
        addExpiration(playerName, playerName, [
            { type: 'remove_active_buff', buffName }
        ], campaignName);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: buffName,
            automationType: auto.type,
            description: wasActive
                ? `${buffName} expired`
                : `${buffName} activated — attackers subtract 1d4 from attack rolls against you`,
            automation: auto,
        },
    };
}
