export async function handle(action, _playerStats, _campaignName) {
    const auto = action.automation;
    const distance = auto.distance || '30 ft';

    return {
        type: 'modal',
        modalName: 'arcaneCharge',
        payload: { action, playerStats: _playerStats, campaignName: _campaignName, distance },
    };
}

export async function confirmArcaneCharge(action, _playerStats, _campaignName) {
    const auto = action.automation;
    const distance = auto.distance || '30 ft';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: Teleported ${distance} to an unoccupied space you can see.`,
            automation: auto,
        },
    };
}
