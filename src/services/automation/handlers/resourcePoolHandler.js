export async function handle(action, _playerStats, _campaignName, _mapName) {
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
