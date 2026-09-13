import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { fetchSpellOverlays, overlayTargetId } from '../../../maps/spellOverlayService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
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

    const targetName = action.targetName;
    let activeOverlay = null;

    const overlayId = overlayTargetId(targetName);
    if (overlayId) {
        const overlays = await fetchSpellOverlays(campaignName);
        activeOverlay = overlays.find(o => o.id === overlayId) || null;
    }

    return {
        type: 'modal',
        modalName: 'elementalAttunement',
        payload: {
            action,
            playerStats,
            campaignName,
            mapName: _mapName,
            activeOverlay,
        },
    };
}
