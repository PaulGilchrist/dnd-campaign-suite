export const miscHandlers = {
    'auto_effect': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'auto_effect',
            name: feature.name,
            trigger: auto.trigger || '',
            effect: auto.effect || '',
            value: auto.value || null,
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            hasAutomation: true
        }
    },

    'auto_reroll': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'auto_reroll',
            name: feature.name,
            target: auto.target || 'd20',
            condition: auto.condition || '',
            effect: auto.effect || 'reroll',
            trigger: auto.trigger || '',
            bonus: auto.bonus ?? null,
            range: auto.range || '',
            resourceCost: auto.resourceCost || '',
            casting_time: auto.casting_time || '',
            bonusExpression: auto.bonusExpression || '',
            oncePerRage: !!auto.oncePerRage,
            hasAutomation: true
        }
    },

    'restore_balance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'restore_balance',
            name: feature.name,
            target: auto.target || 'd20',
            range: auto.range || '60_ft',
            hasAutomation: true
        }
    },

    'countercharm': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'countercharm',
            name: feature.name,
            trigger: auto.trigger || '',
            range: auto.range || '',
            conditions: auto.conditions || [],
            effect: auto.effect || '',
            uses: auto.uses || 1,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'misty_wanderer': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'misty_wanderer',
            name: feature.name,
            trigger: auto.trigger || '',
            range: auto.range || '5_ft',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'moonlight_step_rider': (feature, _playerStats) => {
        return {
            type: 'moonlight_step_rider',
            name: feature.name,
            hasAutomation: true
        }
    },

    'post_cast_rider': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'post_cast_rider',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: auto.saveDc || 'ability',
            saveAbility: auto.saveAbility || 'CHA',
            condition: auto.condition || '',
            duration: auto.duration || '1_minute',
            range: auto.range || '60 ft',
            spellSchools: auto.spellSchools || [],
            recharge: auto.recharge || 'long_rest',
            hasAutomation: true
        }
    },

    'post_cast_smite_cover': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'post_cast_smite_cover',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'post_cast_inspiring_smite': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'post_cast_inspiring_smite',
            name: feature.name,
            range: auto.range || '30 ft',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'resistance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'resistance',
            name: feature.name,
            damageTypes: auto.damageTypes || [],
            hasAutomation: true
        }
    },

    'land_resistance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'land_resistance',
            name: feature.name,
            conditionImmunity: auto.conditionImmunity || '',
            landMappings: auto.landMappings || {},
            hasAutomation: true
        }
    },

    'set_condition': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'set_condition',
            name: feature.name,
            target: auto.target,
            condition: auto.condition,
            additionalCondition: auto.additionalCondition || null,
            cost: auto.cost || '',
            range: auto.range || '60 ft',
            saveType: auto.saveType || 'STR',
            effect: auto.effect || '',
            hasAutomation: true
        }
    },

    'shadow_step_rider': (feature, _playerStats) => {
        return {
            type: 'shadow_step_rider',
            name: feature.name,
            hasAutomation: true
        }
    },

    'relentless_avenger': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'relentless_avenger',
            name: feature.name,
            trigger: auto.trigger || 'after_opportunity_attack_hit',
            duration: auto.duration || 'until_end_of_current_turn',
            hasAutomation: true
        }
    },

    'soul_of_vengeance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'soul_of_vengeance',
            name: feature.name,
            trigger: auto.trigger || 'after_vow_of_enmity_target_attacks',
            hasAutomation: true
        }
    },

    'hunter_prey': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'hunter_prey',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'defensive_tactics': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'defensive_tactics',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'superior_hunter_prey': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'superior_hunter_prey',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'superior_hunter_defense': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'superior_hunter_defense',
            name: feature.name,
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'bonus_action_choice': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'bonus_action_choice',
            name: feature.name,
            options: auto.options || [],
            action: auto.action || 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'steady_aim': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'steady_aim',
            name: feature.name,
            duration: auto.duration || 'until_end_of_turn',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'mage_hand_control': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'mage_hand_control',
            name: feature.name,
            range: auto.range || '30_ft',
            action: auto.action || 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'stroke_of_luck': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'stroke_of_luck',
            name: feature.name,
            target: auto.target || 'd20',
            recharge: auto.recharge || 'short_or_long_rest',
            hasAutomation: true
        }
    },

    'fast_hands': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'fast_hands',
            name: feature.name,
            options: auto.options || [],
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'use_magic_device': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'use_magic_device',
            name: feature.name,
            attunementLimit: auto.attunementLimit || 4,
            chargeReroll: auto.chargeReroll || '1d6',
            chargeRerollSuccess: auto.chargeRerollSuccess || 6,
            scrollAbility: auto.scrollAbility || 'INT',
            scrollCheckDC: auto.scrollCheckDC || '10 + spell_level',
            scrollDisintegratesOnFail: !!auto.scrollDisintegratesOnFail,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'wild_magic_surge': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'wild_magic_surge',
            name: feature.name,
            trigger: auto.trigger || '',
            oncePerTurn: auto.oncePerTurn || false,
            hasAutomation: true
        }
    },

    'wild_magic_tamed': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'wild_magic_tamed',
            name: feature.name,
            trigger: auto.trigger || '',
            recharge: auto.recharge || 'long_rest',
            uses: auto.uses || 1,
            hasAutomation: true
        }
    },

    'feats_of_chaos': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'conditional_advantage',
            name: feature.name,
            target: auto.target || 'd20',
            condition: auto.condition || 'feats_of_chaos_active',
            effect: 'advantage',
            abilities: auto.abilities || [],
            hasAutomation: true
        }
    },

    'multi_target_spread': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'multi_target_spread',
            name: feature.name,
            spellFilter: auto.spellFilter || [],
            range: auto.range || '10 ft',
            hasAutomation: true
        }
    }
}
