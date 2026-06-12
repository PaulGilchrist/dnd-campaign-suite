export async function handle(action, _playerStats, _campaignName, _mapName) {
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
