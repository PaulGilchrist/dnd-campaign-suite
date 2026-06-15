import { handle as handleGiantAncestry } from '../giantAncestryHandler.js';

export async function handle(action, playerStats, campaignName, mapName) {
    // Giant Ancestry has its own sub-option selection flow
    if (action.name === 'Giant Ancestry' || action.automation?.type === 'giant_ancestry') {
        return await handleGiantAncestry(action, playerStats, campaignName, mapName);
    }

    const conversion = action.automation?.conversion || '';
    if (conversion === 'spell_slot_to_moonlight_step') {
        return {
            type: 'modal',
            modalName: 'moonlightStepResource',
            payload: {
                name: action.name,
                description: action.description || '',
                automation: action.automation,
            },
        };
    }
    return {
        type: 'modal',
        modalName: 'resourcePool',
        payload: {
            name: action.name,
            description: action.description || '',
            automation: action.automation,
        },
    };
}
