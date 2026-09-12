import { getSaveDc, resolveUses, resolveDiceExpression, resolveScaling } from '../automationExpressions.js'
import { normalizeCastingTime } from '../../../shared/castingTimeUtils.js'
import { withAutoDefaults } from './infoDefaults.js'

const ACTION_BY_CASTING_TIME = {
    '1 bonus action': 'bonus_action',
    '1 action': 'action',
    '1 reaction': 'reaction',
}

function resolveCastingAction(auto, castingTime) {
    if (auto.action) return auto.action
    if (!castingTime) return null
    return ACTION_BY_CASTING_TIME[normalizeCastingTime(castingTime)] || null
}

function resolveAbilitySaveDc(auto, playerStats, abilityFallback) {
    if (auto.saveDc !== 'ability') return auto.saveDc || 10
    return getSaveDc(playerStats, auto.saveAbility || abilityFallback, playerStats.proficiency || 0)
}

function resolveHealExpression(auto, playerStats) {
    let healExpression = auto.healExpression || ''
    if (auto.healScaling) {
        const healScaling = resolveScaling(playerStats, auto.healScaling)
        if (healScaling?.damage) {
            healExpression = healScaling.damage
        }
    }
    if (healExpression) {
        healExpression = resolveDiceExpression(healExpression, playerStats)
    }
    return healExpression
}

const SAVE_ATTACK_DEFAULTS = {
    damageType: '',
    saveType: 'DEX',
    saveAbility: 'CON',
    shape: '',
    range: '',
    conditionInflicted: null,
    duration: '',
    recharge: 'long_rest',
    resourceCost: '',
    options: [],
    optionDetails: {},
    dcSuccess: null,
}

function resolveSaveAttackDamage(auto, playerStats) {
    const scaling = resolveScaling(playerStats, auto.scaling)
    return resolveDiceExpression(scaling?.damage || auto.damage || '', playerStats)
}

function resolveSaveAttackUses(auto, playerStats) {
    if (auto.resourceCost !== 'wild_shape') return resolveUses(playerStats, auto.uses)
    return playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0
}

export const saveHandlers = {
    'save_attack': (feature, playerStats) => {
        const auto = feature.automation
        const uses = resolveSaveAttackUses(auto, playerStats)
        const castingTime = auto.casting_time || ''
        return {
            type: 'save_attack',
            name: feature.name,
            action: resolveCastingAction(auto, castingTime) || 'action',
            damage: resolveSaveAttackDamage(auto, playerStats),
            saveDc: resolveAbilitySaveDc(auto, playerStats, 'CON'),
            uses,
            usesMax: uses,
            hasOptions: !!auto.hasOptions,
            healExpression: resolveHealExpression(auto, playerStats),
            casting_time: castingTime,
            ...withAutoDefaults(auto, SAVE_ATTACK_DEFAULTS),
            hasAutomation: true
        }
    },

    'elemental_burst': (feature, playerStats) => {
        const auto = feature.automation
        const damage = resolveSaveAttackDamage(auto, playerStats)
        const saveDc = resolveAbilitySaveDc(auto, playerStats, 'CON')
        const castingTime = auto.casting_time || ''
        const action = resolveCastingAction(auto, castingTime)
        return {
            type: 'elemental_burst',
            name: feature.name,
            action: action || 'action',
            damage,
            damageType: auto.damageType || '',
            saveType: auto.saveType || 'DEX',
            saveDc,
            saveAbility: auto.saveAbility || 'CON',
            shape: auto.shape || '',
            range: auto.range || '',
            conditionInflicted: auto.conditionInflicted || null,
            duration: auto.duration || '',
            uses: playerStats.level,
            usesMax: playerStats.level,
            recharge: 'long_rest',
            resourceCost: 'focus_points',
            hasOptions: false,
            options: [],
            optionDetails: {},
            healExpression: '',
            dcSuccess: auto.dcSuccess || null,
            casting_time: castingTime,
            hasAutomation: true
        }
    },

    'save_only': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'save_only',
            name: feature.name,
            saveType: auto.saveType || 'DEX',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'CON', playerStats.proficiency) : auto.saveDc || 10,
            conditionInflicted: auto.conditionInflicted || null,
            duration: auto.duration || '',
            successEffect: auto.successEffect || null,
            hasAutomation: true,
        }
    },

    'charm_person': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'charm_person',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, 'WIS', playerStats.proficiency) : auto.saveDc || 10,
            range: auto.range || '',
            duration: auto.duration || '',
            hasAutomation: true,
        }
    },

    'flesh_to_stone': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'flesh_to_stone',
            name: feature.name,
            saveType: auto.saveType || 'CON',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'CON', playerStats.proficiency) : auto.saveDc || 10,
            conditionInflicted: 'restrained',
            duration: 'Concentration, up to 1 minute',
            hasAutomation: true,
        }
    },

    'hold_monster': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'hold_monster',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'WIS', playerStats.proficiency) : auto.saveDc || 10,
            conditionInflicted: 'paralyzed',
            duration: 'Concentration, up to 1 minute',
            hasAutomation: true,
        }
    },

    'banishment': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'banishment',
            name: feature.name,
            saveType: auto.saveType || 'CHA',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'CHA', playerStats.proficiency) : auto.saveDc || 10,
            conditionInflicted: 'incapacitated',
            duration: 'Concentration, up to 1 minute',
            range: auto.range || '',
            hasAutomation: true,
        }
    },

    'resilient_sphere': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'resilient_sphere',
            name: feature.name,
            saveType: auto.saveType || 'DEX',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'DEX', playerStats.proficiency) : auto.saveDc || 10,
            duration: auto.duration || 'Concentration, up to 1 minute',
            hasAutomation: true,
        }
    },

    'ottos_dance': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'ottos_dance',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'WIS', playerStats.proficiency) : auto.saveDc || 10,
            duration: 'Concentration, up to 1 minute',
            hasAutomation: true,
        }
    },

    'power_word_stun': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'power_word_stun',
            name: feature.name,
            saveType: auto.saveType || 'CON',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'CON', playerStats.proficiency) : auto.saveDc || 10,
            hasAutomation: true,
        }
    },

    'sleep': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'sleep',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'WIS', playerStats.proficiency) : auto.saveDc || 10,
            conditionInflicted: 'incapacitated',
            duration: auto.duration || '',
            hasAutomation: true,
        }
    },

    'stinking_cloud': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'stinking_cloud',
            name: feature.name,
            saveType: auto.saveType || 'CON',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'CON', playerStats.proficiency) : auto.saveDc || 10,
            conditionInflicted: 'poisoned',
            duration: auto.duration || '',
            hasAutomation: true,
        }
    },

    'sleet_storm': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'sleet_storm',
            name: feature.name,
            saveType: auto.saveType || 'DEX',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'DEX', playerStats.proficiency) : auto.saveDc || 10,
            conditionInflicted: 'prone',
            duration: auto.duration || '',
            hasAutomation: true,
        }
    },

    'confusion': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'confusion',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'WIS', playerStats.proficiency) : auto.saveDc || 10,
            conditionInflicted: 'charmed',
            duration: auto.duration || 'Concentration, up to 1 minute',
            hasAutomation: true,
        }
    },

    'tashas_laughter': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'tashas_laughter',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'WIS', playerStats.proficiency) : auto.saveDc || 10,
            conditionInflicted: ['prone', 'incapacitated'],
            duration: auto.duration || '',
            hasAutomation: true,
        }
    },

    'imprisonment': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'imprisonment',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'WIS', playerStats.proficiency) : auto.saveDc || 10,
            duration: 'Until dispelled',
            options: auto.options || [],
            hasAutomation: true,
        }
    },

    'prismatic_spray': (feature, playerStats) => {
        const auto = feature.automation
        const scaling = resolveScaling(playerStats, auto.scaling)
        const rawDamage = scaling?.damage || auto.damage || '10d6'
        const damage = rawDamage
        return {
            type: 'prismatic_spray',
            name: feature.name,
            saveType: auto.saveType || 'DEX',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'DEX', playerStats.proficiency) : auto.saveDc || 10,
            damage,
            hasAutomation: true,
        }
    },

    'forcecage': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'forcecage',
            name: feature.name,
            saveType: auto.saveType || 'CHA',
            saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, auto.saveAbility || 'CHA', playerStats.proficiency) : auto.saveDc || 10,
            duration: auto.duration || 'Concentration, up to 1 hour',
            concentration: !!auto.concentration,
            ruleset: auto.ruleset || '5e',
            hasAutomation: true,
        }
    },
}
