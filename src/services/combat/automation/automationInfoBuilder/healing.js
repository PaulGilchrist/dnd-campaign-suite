import { evaluateAutoExpression, resolveHealingPoolExpression } from '../automationExpressions.js'
import { getHitDieSize } from '../../../rules/effects/restRules.js'

export const healingHandlers = {
    'healing': (feature, playerStats) => {
        const auto = feature.automation
        const prof = playerStats.proficiency || 0
        const level = playerStats.level || 1
        const healAmount = auto.healExpression
            ? evaluateAutoExpression(auto.healExpression, playerStats, prof, level)
            : 0
        const action = auto.action || 'action'
        const usesMax = auto.uses ?? null
        return {
            type: 'healing',
            name: feature.name,
            healAmount,
            healExpression: auto.healExpression || '',
            action,
            uses: usesMax,
            usesMax,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '',
            hasAutomation: true
        }
    },

    'healing_pool': (feature, playerStats) => {
        const auto = feature.automation
        const prof = playerStats.proficiency || 0
        const level = playerStats.level || 1
        const baseExpression = auto.poolExpression || ''
        const resolvedExpression = resolveHealingPoolExpression(baseExpression, auto.scaling, playerStats)
        const explicitDicePool = auto.isDicePool === true
        const diceMatch = resolvedExpression.match(/^(\d+)d(\d+)$/i)
        const isDicePool = explicitDicePool || !!diceMatch
        const pool = isDicePool
            ? (explicitDicePool
                ? evaluateAutoExpression(resolvedExpression, playerStats, prof, level)
                : parseInt(diceMatch[1], 10))
            : (resolvedExpression ? evaluateAutoExpression(resolvedExpression, playerStats, prof, level) : 0)
        return {
            type: 'healing_pool',
            name: feature.name,
            pool,
            poolExpression: resolvedExpression,
            isDicePool,
            dieType: explicitDicePool ? (auto.dieType || 6) : (isDicePool ? parseInt(diceMatch[2], 10) : null),
            action: auto.action || 'action',
            recharge: auto.recharge || 'long_rest',
            alsoCures: auto.alsoCures || [],
            cureCost: auto.cureCost || 5,
            range: auto.range || '',
            resourceCost: auto.resourceCost || '',
            resourceKey: feature.name.toLowerCase().replace(/\s+/g, '') + 'Pool',
            maxDicePerUse: auto.maxDicePerUse || '',
            hasAutomation: true
        }
    },

    'self_healing': (feature, playerStats) => {
        const auto = feature.automation
        const prof = playerStats.proficiency || 0
        const level = playerStats.level || 1
        const hitDiceCost = auto.hitDiceCost || 0
        const isHitDieRoll = auto.healExpression === 'hit_die_roll'
        let healAmount = 0
        if (isHitDieRoll) {
            const hitDieSize = getHitDieSize(playerStats)
            healAmount = hitDieSize
        } else if (auto.healExpression) {
            healAmount = evaluateAutoExpression(auto.healExpression, playerStats, prof, level)
        }
        return {
            type: 'self_healing',
            name: feature.name,
            healAmount,
            healExpression: auto.healExpression || '',
            action: auto.action || 'action',
            uses: auto.uses ?? 1,
            usesMax: auto.uses ?? 1,
            recharge: auto.recharge || 'short_rest',
            bloodiedOnly: !!auto.bloodiedOnly,
            hitDiceCost,
            hasAutomation: true
        }
    },

    'buff_ally': (feature, playerStats) => {
        const auto = feature.automation
        const usesMax = auto.uses_expression
            ? evaluateAutoExpression(auto.uses_expression, playerStats)
            : 0
        return {
            type: 'buff_ally',
            name: feature.name,
            buffExpression: auto.buffExpression || '',
            range: auto.range || '60_ft',
            action: auto.action || 'bonus_action',
            usesMax,
            usesRecharge: auto.recharge || 'long_rest',
            hasAutomation: true
        }
    },

    'heroic_inspiration_buff': (feature, playerStats) => {
        const auto = feature.automation
        const usesMax = auto.uses_expression
            ? evaluateAutoExpression(auto.uses_expression, playerStats)
            : 0
        return {
            type: 'buff_ally',
            name: feature.name,
            buffExpression: auto.buffExpression || '',
            range: auto.range || '60_ft',
            action: auto.action || 'action',
            usesMax,
            usesRecharge: auto.recharge || 'short_or_long_rest',
            targetsExpression: auto.targetsExpression || '',
            hasAutomation: true
        }
    },

    'divine_spark': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'divine_spark',
            name: feature.name,
            range: auto.range || '30 ft',
            healExpression: auto.healExpression || '',
            damageExpression: auto.damageExpression || '',
            damageTypes: auto.damageTypes || [],
            saveType: auto.saveType || 'CON',
            resourceCost: auto.resourceCost || '',
            hasAutomation: true
        }
    },

    'reaction_save_heal': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'reaction_save_heal',
            name: feature.name,
            saveType: auto.saveType || 'CON',
            saveDc: auto.saveDc || 10,
            dcScaling: auto.dcScaling || 0,
            healExpression: auto.healExpression || '',
            recharge: auto.recharge || 'short_or_long_rest',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'post_cast_self_heal': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'post_cast_self_heal',
            name: feature.name,
            healExpression: auto.healExpression || '0',
            othersOnly: auto.othersOnly ?? true,
            hasAutomation: true
        }
    },

    'post_cast_ally_heal': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'post_cast_ally_heal',
            name: feature.name,
            healExpression: auto.healExpression || '0',
            othersOnly: auto.othersOnly ?? true,
            range: auto.range || '30_ft',
            hasAutomation: true
        }
    },

    'heroes_feast': (feature, playerStats) => {
        const auto = feature.automation
        const slotLevel = auto.slotLevel || 6
        const prof = playerStats.proficiency || 0
        const level = playerStats.level || 1
        const hpIncrease = auto.hpMaxIncreaseExpression
            ? evaluateAutoExpression(auto.hpMaxIncreaseExpression, playerStats, prof, level, slotLevel)
            : 11
        return {
            type: 'heroes_feast',
            name: feature.name,
            hpMaxIncrease: hpIncrease,
            hpMaxIncreaseExpression: auto.hpMaxIncreaseExpression || '2d10',
            slotLevel,
            range: auto.range || 'Self',
            maxTargets: auto.maxTargets || 12,
            duration: auto.duration || '24 hours',
            action: auto.action || 'action',
            hasAutomation: true
        }
    },

    'healing_bonus': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            effect: 'bonus_healing',
            name: feature.name,
            description: feature.description || '',
            bonusExpression: auto.extraHealing || '0',
            trigger: auto.trigger || '',
            hasAutomation: true
        }
    }
}
