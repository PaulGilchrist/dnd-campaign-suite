import { evaluateAutoExpression } from '../automationExpressions.js'
import { withAutoDefaults } from './infoDefaults.js'

const DAMAGE_BONUS_DEFAULTS = {
    trigger: '',
    damageType: '',
    maxDamage: '',
    extraVs: null,
    extraDamage: '',
    extraDamageExpression: '',
    extraDamageType: '',
    resourceType: 'spell_slot',
    options: [],
    tempHpExpression: '',
    upgrades: '',
    rangeBonusCantrip: '',
    uses_expression: '',
    recharge: '',
    abilityIncreased: '',
}

function isHunterMarkedBeastRanger(playerStats) {
    const isRanger = playerStats.class?.name === 'Ranger'
    const hasBestialFury = (playerStats.class?.major?.features || []).some(f => f.name === 'Bestial Fury')
    return isRanger && hasBestialFury && playerStats.concentration?.spell === "Hunter's Mark"
}

function hunterMarkStrikeExpression(playerStats, fallback) {
    const highestSlotLevel = [7, 5, 3, 1].find(lv => playerStats.spellAbilities?.[`spell_slots_level_${lv}`] > 0)
    if (!highestSlotLevel) return fallback
    if (playerStats.level >= 20) return '1d10'
    return ({ 1: '1d6', 3: '1d8', 5: '1d10', 7: '1d12' })[highestSlotLevel] || '1d6'
}

function resolveScaledExpression(auto, playerStats) {
    let resolvedExpr = auto.damageExpression || '';
    if (!auto.scaling) return resolvedExpr;
    const entries = Object.entries(auto.scaling)
        .map(([k, v]) => ({ level: parseInt(k, 10), expr: String(v) }))
        .filter(e => !isNaN(e.level))
        .sort((a, b) => a.level - b.level);
    for (const entry of entries) {
        if (playerStats.level >= entry.level) {
            resolvedExpr = entry.expr;
        }
    }
    return resolvedExpr;
}

function resolveDamageBonusUsesMax(auto, playerStats) {
    if (auto.uses_expression) {
        return evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
    }
    if (auto.uses) {
        return auto.uses;
    }
    return 0;
}

export const damageHandlers = {
    'damage_bonus': (feature, playerStats) => {
        const auto = feature.automation
        return {
            type: 'damage_bonus',
            name: feature.name,
            ...withAutoDefaults(auto, DAMAGE_BONUS_DEFAULTS),
            damageExpression: resolveScaledExpression(auto, playerStats),
            oncePerTurn: !!auto.oncePerTurn,
            usesMax: resolveDamageBonusUsesMax(auto, playerStats),
            hasAutomation: true
        }
    },

    'damage_modifier': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'damage_modifier',
            name: feature.name,
            trigger: auto.trigger || '',
            modifierExpression: auto.modifierExpression || '',
            hasAutomation: true
        }
    },

    'damage_type_modifier': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'damage_type_modifier',
            name: feature.name,
            trigger: auto.trigger || '',
            weaponTypes: auto.weaponTypes || [],
            options: auto.options || [],
            hasAutomation: true
        }
    },

    'damage_type_choice': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'damage_type_choice',
            name: feature.name,
            damageTypes: auto.damageTypes || [],
            effect: auto.effect || '',
            casting_time: auto.casting_time || 'passive',
            minDamage: !!auto.minDamage,
            hasAutomation: true
        }
    },

    'weapon_mastery_choice': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'weapon_mastery_choice',
            name: feature.name,
            description: feature.description || '',
            masteryProperties: auto.masteryProperties || [],
            effect: auto.effect || 'extra_mastery',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'damage_reduction': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'damage_reduction',
            name: feature.name,
            reductionExpression: auto.reductionExpression || '',
            trigger: auto.trigger || '',
            reaction: auto.reaction || false,
            redirect: auto.redirect || false,
            redirectCost: auto.redirectCost || null,
            redirectDamage: auto.redirectDamage || '',
            redirectSave: auto.redirectSave || 'DEX',
            cost: auto.cost || null,
            damageTypes: auto.damageTypes || [],
            condition: auto.condition || '',
            effect: auto.effect || '',
            requiresShield: !!auto.requiresShield,
            hasAutomation: true
        }
    },

    'damage_aura': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'damage_aura',
            name: feature.name,
            damageType: auto.damageType || '',
            damageExpression: auto.damageExpression || '',
            range: auto.range || '10_ft',
            duration: auto.duration || '1_minute',
            recharge: auto.recharge || 'long_rest',
            hasAutomation: true
        }
    },

    'psionic_strike': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'psionic_strike',
            name: feature.name,
            resource: auto.resource || 'psionicEnergy',
            damageExpression: auto.damageExpression || '',
            damageType: auto.damageType || 'Force',
            oncePerTurn: !!auto.oncePerTurn,
            trigger: auto.trigger || 'after_attack_hit',
            hasAutomation: true
        }
    },

    'primal_companion_double_strike_damage': (feature, playerStats) => {
        const auto = feature.automation
        let damageExpression = auto.damageExpression || ''
        if (isHunterMarkedBeastRanger(playerStats)) {
            damageExpression = hunterMarkStrikeExpression(playerStats, damageExpression)
        }

        return {
            type: 'damage_bonus',
            name: feature.name,
            trigger: 'companion_beasts_strike_hit',
            damageExpression,
            damageType: auto.damageType || '',
            oncePerTurn: !!auto.oncePerTurn,
            hasAutomation: true
        }
    },

    'great_weapon_fighting': (feature, _playerStats) => {
        return {
            type: 'passive_rule',
            effect: 'great_weapon_fighting',
            name: feature.name,
            hasAutomation: true
        }
    },

    'grapple_damage': (feature, _playerStats) => {
        return {
            type: 'passive_rule',
            effect: 'grapple_damage',
            name: feature.name,
            hasAutomation: true
        }
    },

    'two_weapon_fighting': (feature, _playerStats) => {
        return {
            type: 'passive_rule',
            effect: 'two_weapon_fighting',
            name: feature.name,
            hasAutomation: true
        }
    },

    'reroll_damage_once_per_turn': (feature, _playerStats) => {
        return {
            type: 'passive_rule',
            effect: 'reroll_damage_once_per_turn',
            name: feature.name,
            hasAutomation: true
        }
    },

    'damage': (feature, _playerStats) => {
        if (feature.type === 'damage' && feature.source === 'feat' && feature.automation?.type === 'great_weapon_fighting') {
            return {
                type: 'passive_rule',
                effect: 'great_weapon_fighting',
                name: feature.name,
                hasAutomation: true
            }
        }
        if (feature.type === 'two_weapon_fighting' && feature.source === 'feat' && feature.automation?.type === 'two_weapon_fighting') {
            return {
                type: 'passive_rule',
                effect: 'two_weapon_fighting',
                name: feature.name,
                hasAutomation: true
            }
        }
        return null
    },

    'piercer_puncture': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'piercer_puncture',
            name: feature.name,
            effect: auto.effect || 'reroll_damage_die',
            rerollCount: auto.rerollCount || 1,
            oncePerTurn: !!auto.oncePerTurn,
            mustUseNew: !!auto.mustUseNew,
            casting_time: auto.casting_time || 'reaction',
            hasAutomation: true
        }
    }
}
