export async function handle(action, _playerStats, _campaignName) {
    return {
        type: 'modal',
        modalName: 'naturalRecovery',
        payload: {
            name: action.name,
            description: action.description || '',
            automation: action.automation,
        },
    };
}
