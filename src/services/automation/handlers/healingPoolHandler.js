export async function handle(action, playerStats, _campaignName, _mapName) {
    const auto = action.automation;

    const restoringTouchData = playerStats.characterAdvancement?.find(
         f => f.name === 'Restoring Touch'
         );

    return {
        type: 'modal',
        modalName: 'healingPool',
        payload: {
            name: action.name,
            pool: auto.pool,
            poolExpression: auto.poolExpression,
            resourceKey: auto.resourceKey,
            alsoCures: auto.alsoCures || [],
            cureCost: auto.cureCost || 5,
            restoringTouchConditions: restoringTouchData?.automation?.cureConditions || [],
            },
          };
 }
