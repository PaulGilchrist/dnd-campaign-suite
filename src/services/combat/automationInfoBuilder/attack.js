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
        let options = auto.options || [];
        if (options.length === 0 && !Array.isArray(auto.effects) && auto.effect === 'push') {
            const dist = (auto.distance || '10 ft').replace(/[^0-9]/g, '');
            options = [{
                name: 'Push',
                effect: 'push',
                value: parseInt(dist, 10) || 10,
                sizeLimit: auto.sizeLimit || null,
            }];
        }
        if (options.length === 0 && !Array.isArray(auto.effects) && auto.effect === 'reduce_speed') {
            const speedMatch = (auto.speedReduction || '10 ft').match(/(\d+)/);
            options = [{
                name: 'Reduce Speed',
                effect: 'speed_reduction',
                value: parseInt(speedMatch ? speedMatch[1] : '10', 10) || 10,
            }];
        }
        if (options.length === 0 && !Array.isArray(auto.effects) && auto.effect === 'push_or_prone') {
            const dist = (auto.distance || '5 ft').replace(/[^0-9]/g, '');
            options = [
                {
                    name: 'Push',
                    effect: 'push',
                    value: parseInt(dist, 10) || 5,
                    sizeLimit: auto.sizeLimit || null,
                },
                {
                    name: 'Prone',
                    effect: 'prone',
                    saveType: auto.saveType || 'STR',
                    saveDc: auto.saveDc || 'ability',
                    saveAbility: auto.saveAbility || 'STR',
                },
            ];
            if (auto.oncePerTurn) {
                options[1].saveDc = auto.saveDc || 'ability';
            }
        }
        if (options.length === 0 && Array.isArray(auto.effects)) {
            options = auto.effects.map(effect => {
                if (effect.option === 'damage_bonus') {
                    const dice = effect.dice || '1d6';
                    return {
                        name: effect.name || 'Damage Bonus',
                        effect: 'damage_bonus',
                        damageExpression: dice,
                        damageType: effect.damageType || '',
                    };
                }
                if (effect.option === 'push') {
                    const dist = (effect.distance || '10 ft').replace(/[^0-9]/g, '');
                    return {
                        name: effect.name || 'Push',
                        effect: 'push',
                        value: parseInt(dist, 10) || 10,
                        sizeLimit: effect.sizeLimit || null,
                    };
                }
                if (effect.option === 'prone') {
                    return {
                        name: effect.name || 'Prone',
                        effect: 'prone',
                        saveType: effect.saveType || 'DEX',
                        saveDc: effect.saveDc || 'ability',
                        saveAbility: effect.saveAbility || 'DEX',
                    };
                }
                if (effect.option === 'poisoned') {
                    return {
                        name: effect.name || 'Poisoned',
                        effect: 'poisoned',
                        saveType: effect.saveType || 'CON',
                        saveDc: effect.saveDc || 'ability',
                        saveAbility: effect.saveAbility || 'CON',
                    };
                }
                if (effect.option === 'unconscious') {
                    return {
                        name: effect.name || 'Unconscious',
                        effect: 'unconscious',
                        saveType: effect.saveType || 'CON',
                        saveDc: effect.saveDc || 'ability',
                        saveAbility: effect.saveAbility || 'CON',
                    };
                }
                if (effect.option === 'blinded') {
                    return {
                        name: effect.name || 'Blinded',
                        effect: 'blinded',
                        saveType: effect.saveType || 'DEX',
                        saveDc: effect.saveDc || 'ability',
                        saveAbility: effect.saveAbility || 'DEX',
                    };
                }
                return {
                    name: effect.name || effect.option,
                    effect: effect.effect || effect.option,
                    value: effect.value || null,
                    sizeLimit: effect.sizeLimit || null,
                };
            });
        }
        return {
            type: 'attack_rider',
            name: feature.name,
            options,
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
            weaponRequirement: auto.weaponRequirement || null,
            hasAutomation: true
        }
    },

    'bonus_attacks': (feature, _playerStats) => {
        const auto = feature.automation
        let action = null
        const ct = auto.casting_time || ''
        if (/bonus/i.test(ct)) {
            action = 'bonus_action'
        }
        else if (/reaction/i.test(ct)) {
            action = 'reaction'
        }
        else if (/action/i.test(ct)) {
            action = 'action'
        }
        return {
            type: 'bonus_attacks',
            name: feature.name,
            attacks: auto.attacks || auto.extraAttacks || 2,
            attackType: auto.attackType || 'unarmed_strike',
            cost: auto.cost || null,
            trigger: auto.trigger || 'after_attack_action',
            action,
            casting_time: ct || null,
            weaponRequirements: auto.weaponRequirements || null,
            weaponRestriction: auto.weaponRestriction || null,
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
            attacks: auto.attacks || 2,
            weaponRequirement: auto.weaponRequirement || null,
            attack_type: auto.attack_type || 'ranged',
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
