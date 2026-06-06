export async function handle(action, _playerStats, _campaignName, _mapName) {
    if (action.name === 'Metamagic') {
        return null;
      }

    const auto = action.automation;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: action.description || '',
            automation: auto,
          },
      };
 }
