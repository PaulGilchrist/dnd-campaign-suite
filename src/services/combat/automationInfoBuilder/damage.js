import { evaluateAutoExpression } from '../automationExpressions.js'

export const damageHandlers = {
    'damage_bonus': (feature, playerStats) => {
        const auto = feature.automation
        let resolvedExpr = auto.damageExpression || '';
        if (auto.scaling) {
            const entries = Object.entries(auto.scaling)
                .map(([k, v]) => ({ level: parseInt(k, 10), expr: String(v) }))
                .filter(e => !isNaN(e.level))
                .sort((a, b) => a.level - b.level);
            for (const entry of entries) {
                if (playerStats.level >= entry.level) {
                    resolvedExpr = entry.expr;
                }
            }
        }
        let usesMax = 0;
        if (auto.uses_expression) {
            usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
        } else if (auto.uses) {
            usesMax = auto.uses;
        }
        return {
            type: 'damage_bonus',
            name: feature.name,
            trigger: auto.trigger || '',
            damageExpression: resolvedExpr,
            damageType: auto.damageType || '',
            maxDamage: auto.maxDamage || '',
            extraVs: auto.extraVs || null,
            extraDamage: auto.extraDamage || '',
            extraDamageExpression: auto.extraDamageExpression || '',
            extraDamageType: auto.extraDamageType || '',
            resourceType: auto.resourceType || 'spell_slot',
            oncePerTurn: !!auto.oncePerTurn,
            options: auto.options || [],
            tempHpExpression: auto.tempHpExpression || '',
            upgrades: auto.upgrades || '',
            rangeBonusCantrip: auto.rangeBonusCantrip || '',
            uses_expression: auto.uses_expression || '',
            usesMax,
            recharge: auto.recharge || '',
            abilityIncreased: auto.abilityIncreased || '',
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

    'primal_companion_double_strike_damage': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'damage_bonus',
            name: feature.name,
            trigger: 'companion_beasts_strike_hit',
            damageExpression: auto.damageExpression || '',
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
    }
}
