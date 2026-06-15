import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

const HANDLER_MODAL = 'createThrall';
const HANDLER_CONFIRM = 'create_thrall_confirm';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Create Thrall';

    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? auto.usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free casts remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: HANDLER_MODAL,
        payload: {
            action,
            playerStats,
            campaignName,
            noConcentrationOption: true,
        },
    };
}

export async function confirmCreateThrall(action, playerStats, campaignName, noConcentration) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Create Thrall';

    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? auto.usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free casts remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    const newCount = currentCount - 1;
    await setRuntimeValue(playerName, freeCastCountKey, newCount, campaignName);

    const spellName = auto.spell || 'Summon Aberration';
    const noConcLabel = noConcentration ? ' Does not require Concentration.' : '';
    const durLabel = noConcentration ? ' Duration: 1 minute.' : '';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName}: Free cast of ${spellName} (${newCount} remaining).${noConcLabel}${durLabel}<br/><br/><em>Open your spell sheet and cast ${spellName} normally — no spell slot or material components will be consumed.</em>`,
            automation: { ...auto, noConcentration },
        },
    };
}

export { HANDLER_MODAL as modalName, HANDLER_CONFIRM as confirmType };
