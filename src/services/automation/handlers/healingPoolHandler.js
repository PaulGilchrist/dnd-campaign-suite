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
            isDicePool: auto.isDicePool,
            dieType: auto.dieType,
            resourceKey: auto.resourceKey,
            alsoCures: auto.alsoCures || [],
            cureCost: auto.cureCost || 5,
            range: auto.range || '',
            resourceCost: auto.resourceCost || '',
            bloodiedOnly: !!auto.bloodiedOnly,
            restoringTouchConditions: restoringTouchData?.automation?.cureConditions || [],
            },
          };
  }
