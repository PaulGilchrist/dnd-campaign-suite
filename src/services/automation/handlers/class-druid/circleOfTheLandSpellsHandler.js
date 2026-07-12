export async function handle(action, _playerStats, _campaignName) {
    return {
        type: 'modal',
        modalName: 'circleOfTheLandSpells',
        payload: {
            name: action.name,
            description: action.description || '',
        },
    };
}
