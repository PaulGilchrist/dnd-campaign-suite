import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const maxFP = classLevel?.focus_points || 0;
    const storedFP = getRuntimeValue(playerStats.name, 'focusPoints', campaignName);
    const currentFP = storedFP != null ? Number(storedFP) : (playerStats._trackedResources?.focusPoints?.current ?? maxFP);

    if (currentFP < 2) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Not enough Focus Points remaining. 2 required.`,
                automation: action.automation,
            },
        };
    }

    await setRuntimeValue(playerStats.name, 'focusPoints', currentFP - 2, campaignName);
    window.dispatchEvent(new CustomEvent('focus-points-updated'));

    return {
        type: 'modal',
        modalName: 'elementalBurst',
        payload: {
            action,
            playerStats,
            campaignName,
            mapName,
        },
    };
}
