import { resolveHealingPoolExpression, evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js'
import { getCombatContext } from '../../../rules/combat/damageUtils.js'
import { isWithinRange } from '../../../rules/combat/rangeCheck.js'
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js'
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../../ui/logService.js'

export function resolveChannelDivinityCharges(playerStats) {
    const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges')
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1]
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges
    return { currentCharges, maxCharges }
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    if (auto.resourceCost === 'channel_divinity') {
        const { currentCharges } = resolveChannelDivinityCharges(playerStats)
        if (currentCharges <= 0) {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: action.name,
                description: `${playerStats.name} attempted to use ${action.name} but has no Channel Divinity charges remaining.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[healingPoolHandler] Error:', e); });
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: 'No Channel Divinity charges remaining.',
                    automation: auto,
                },
            };
        }
    }

    const prof = playerStats.proficiency || 0
    const level = playerStats.level || 1
    const baseExpression = auto.poolExpression || ''
    const resolvedExpression = resolveHealingPoolExpression(baseExpression, auto.scaling, playerStats)
    const poolInfo = resolveHealingPool(auto, action, playerStats, resolvedExpression, prof, level)

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
        payload: buildHealingPoolPayload(auto, action, playerStats, resolvedExpression, poolInfo, creatureTargets),
    };
}

function resolveHealingPool(auto, action, playerStats, resolvedExpression, prof, level) {
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
    return { pool, dieType, resourceKey, isDicePool }
}

function buildHealingPoolPayload(auto, action, playerStats, resolvedExpression, { pool, dieType, resourceKey, isDicePool }, creatureTargets) {
    const restoringTouchData = playerStats.specialActions?.find(
          f => f.name === 'Restoring Touch'
          );
    return {
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
        };
}
