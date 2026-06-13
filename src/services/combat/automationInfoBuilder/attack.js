import { evaluateAutoExpression } from '../automationExpressions.js'

export const attackHandlers = {
    'attack_rider': (feature, playerStats) => {
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
        return {
            type: 'attack_rider',
            name: feature.name,
            options: auto.options || [],
            cost: auto.cost || null,
            damageExpression: resolvedExpr,
            damageType: auto.damageType || '',
            trigger: auto.trigger || '',
            oncePerTurn: !!auto.oncePerTurn,
            chooseOne: !!auto.chooseOne,
            maxEffects: auto.maxEffects || 1,
            saveType: auto.saveType || null,
            saveDc: auto.saveDc || null,
            saveAbility: auto.saveAbility || null,
            damageDoubled: !!auto.damageDoubled,
            restoreCost: auto.restoreCost || null,
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'open_hand_technique': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'open_hand_technique',
            name: feature.name,
            options: auto.options || [],
            saveType: auto.saveType || 'STR',
            saveDc: auto.saveDc || 'ability',
            saveAbility: auto.saveAbility || 'WIS',
            hasAutomation: true
        }
    },

    'mastery_rider': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'mastery_rider',
            name: feature.name,
            masteries: auto.masteries || [],
            extraMastery: auto.extraMastery || [],
            trigger: auto.trigger || 'hit',
            hasAutomation: true
        }
    },

    'bonus_action_attack': (feature, playerStats) => {
        const auto = feature.automation
        const usesMax = auto.uses_expression
            ? evaluateAutoExpression(auto.uses_expression, playerStats)
            : 0
        return {
            type: 'bonus_action_attack',
            name: feature.name,
            trigger: auto.trigger || '',
            action: auto.action || 'bonus_action',
            weaponAttack: !!auto.weaponAttack,
            extraDamageExpression: auto.extraDamageExpression || '',
            usesMax,
            recharge: auto.recharge || 'long_rest',
            resourceKey: 'warPriestUses',
            hasAutomation: true
        }
    },

    'bonus_attacks': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'bonus_attacks',
            name: feature.name,
            attacks: auto.attacks || 2,
            attackType: auto.attackType || 'unarmed_strike',
            cost: auto.cost || null,
            trigger: auto.trigger || 'after_attack_action',
            hasAutomation: true
        }
    },

    'concentration_bonus_attack': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'concentration_bonus_attack',
            name: feature.name,
            trigger: auto.trigger || 'each_turn',
            action: auto.action || 'bonus_action',
            weaponAttack: !!auto.weaponAttack,
            concentrationSpell: auto.concentrationSpell || '',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'stealth_attack': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'stealth_attack',
            name: feature.name,
            cost: auto.cost || '1d6',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'war_bond_summon': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'war_bond_summon',
            name: feature.name,
            action: auto.action || 'bonus_action',
            bondedWeaponCount: auto.bondedWeaponCount || 2,
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    }
}
