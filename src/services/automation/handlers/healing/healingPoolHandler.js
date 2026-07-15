import { resolveHealingPoolExpression } from '../../../combat/automation/automationExpressions.js'

export async function handle(action, playerStats, _campaignName, _mapName) {
    const auto = action.automation;

    const restoringTouchData = playerStats.characterAdvancement?.find(
         f => f.name === 'Restoring Touch'
         );

    const baseExpression = auto.poolExpression || '';
    const resolvedExpression = resolveHealingPoolExpression(baseExpression, auto.scaling, playerStats);
    const diceMatch = resolvedExpression.match(/^(\d+)d(\d+)$/i);
    const isDicePool = auto.isDicePool === true || !!diceMatch;
    const pool = isDicePool
        ? (diceMatch ? parseInt(diceMatch[1], 10) : (auto.pool ?? 0))
        : (auto.pool ?? 0);
    const dieType = isDicePool
        ? (diceMatch ? parseInt(diceMatch[2], 10) : (auto.dieType || null))
        : (auto.dieType || null);
    const resourceKey = auto.resourceKey || (isDicePool ? action.name.toLowerCase().replace(/\s+/g, '') + 'Pool' : null);

    return {
        type: 'modal',
        modalName: 'healingPool',
        payload: {
            name: action.name,
            pool: pool,
            poolExpression: resolvedExpression,
            isDicePool: isDicePool,
            dieType: dieType,
            resourceKey: resourceKey,
            alsoCures: auto.alsoCures || [],
            cureCost: auto.cureCost || 5,
            range: auto.range || '',
            resourceCost: auto.resourceCost || '',
            bloodiedOnly: !!auto.bloodiedOnly,
            restoringTouchConditions: restoringTouchData?.automation?.cureConditions || [],
            maxDicePerUse: auto.maxDicePerUse || '',
            },
          };
   }
