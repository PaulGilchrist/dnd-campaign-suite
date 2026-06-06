import { toggleBuff } from '../common/buffToggle.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const { wasActive } = toggleBuff(
        playerStats.name,
        action.name,
        auto,
        campaignName
    );

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: wasActive
                ? `${action.name} toggled OFF`
                : `${action.name} activated (${auto.duration || '10 min'})`,
            automation: auto,
        },
    };
 }
