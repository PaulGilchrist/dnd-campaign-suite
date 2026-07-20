import { resolveHealingPoolExpression, evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js'
import { getCombatContext } from '../../../rules/combat/damageUtils.js'
import { isWithinRange } from '../../../rules/combat/rangeCheck.js'
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js'

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const restoringTouchData = playerStats.specialActions?.find(
          f => f.name === 'Restoring Touch'
          );

    const prof = playerStats.proficiency || 0
    const level = playerStats.level || 1
    const baseExpression = auto.poolExpression || ''
    const resolvedExpression = resolveHealingPoolExpression(baseExpression, auto.scaling, playerStats)
    const diceMatch = resolvedExpression.match(/^(\d+)d(\d+)$/i)
    const explicitDicePool = auto.isDicePool === true
    const isDicePool = explicitDicePool || !!diceMatch
    const pool = isDicePool
        ? (diceMatch ? parseInt(diceMatch[1], 10) : (explicitDicePool ? evaluateAutoExpression(resolvedExpression, playerStats, prof, level) || 0 : (auto.pool ?? 0)))
        : (auto.pool ?? 0)
    const dieType = isDicePool
        ? (explicitDicePool ? (auto.dieType || null) : (diceMatch ? parseInt(diceMatch[2], 10) : null))
        : (auto.dieType || null)
    const resourceKey = auto.resourceKey || (isDicePool ? action.name.toLowerCase().replace(/\s+/g, '') + 'Pool' : null)

    const rangeFt = auto?.range ? rangeToFeet(auto.range) : 60
    const combatSummary = await getCombatContext(campaignName)
    let creatureTargets = null

    if (combatSummary && combatSummary.creatures?.length > 0) {
        const targets = []
        for (const creature of combatSummary.creatures) {
            if (await isWithinRange(playerStats.name, creature.name, rangeFt)) {
                targets.push({ name: creature.name, type: creature.type, currentHp: creature.currentHp, maxHp: creature.maxHp })
            }
        }
        if (targets.length > 0) {
            creatureTargets = targets
        }
    }

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
            creatureTargets: creatureTargets,
            },
          };
   }
