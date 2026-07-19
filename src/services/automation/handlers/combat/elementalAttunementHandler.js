import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const elementalAttunementActive = getRuntimeValue(playerStats.name, 'elementalAttunementActive', campaignName);
    if (elementalAttunementActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Elemental Attunement is already active.',
                automation: action.automation,
            },
        };
    }

    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const maxFP = classLevel?.focus_points || 0;
    const storedFP = getRuntimeValue(playerStats.name, 'focusPoints', campaignName);
    const currentFP = storedFP != null ? Number(storedFP) : (playerStats._trackedResources?.focusPoints?.current ?? maxFP);

    if (currentFP <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No Focus Points remaining.`,
                automation: action.automation,
            },
        };
    }

    await setRuntimeValue(playerStats.name, 'focusPoints', currentFP - 1, campaignName);
    window.dispatchEvent(new CustomEvent('focus-points-updated'));

    const targetName = action.targetName;
    let activeOverlay = null;

    if (targetName?.startsWith('overlay-')) {
        const overlayId = targetName.slice('overlay-'.length);
        try {
            const response = await fetch(`/api/campaigns/${campaignName}/spell-overlays`);
            const overlays = await response.json();
            activeOverlay = overlays.find(o => o.id === overlayId) || null;
        } catch (error) {
            console.error('[elementalAttunementHandler] Error fetching overlay:', error);
        }
    }

    return {
        type: 'modal',
        modalName: 'elementalAttunement',
        payload: {
            action,
            playerStats,
            campaignName,
            mapName,
            activeOverlay,
        },
    };
}
