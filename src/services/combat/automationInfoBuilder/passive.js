export const passiveHandlers = {
    'passive_buff': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: auto.effect === 'max_hp_increase' ? 'passive_rule' : 'passive_buff',
            name: feature.name,
            target: auto.target || 'allies_in_range',
            range_expression: auto.range_expression || '10_ft',
            effect: auto.effect || '',
            bonusExpression: auto.bonusExpression || auto.bonus || '',
            condition: auto.condition || '',
            conditionImmunity: auto.conditionImmunity || '',
            resistances: auto.resistances || [],
            options: auto.options || [],
            extraMastery: auto.extraMastery || [],
            replaceMastery: auto.replaceMastery || [],
            grantsFlySpeed: !!auto.grantsFlySpeed,
            grantsSwimSpeed: !!auto.grantsSwimSpeed,
            resistanceType: auto.resistanceType || [],
            validTypes: auto.validTypes || [],
            amount: auto.amount || 0,
            alsoSelfHealing: auto.alsoSelfHealing || null,
            hasAutomation: true
        }
    },

    'ignore_resistance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'ignore_resistance',
            damageTypes: auto.damageTypes || [],
            hasAutomation: true
        }
    },

    'passive_immunity': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_immunity',
            name: feature.name,
            target: auto.target || 'self',
            conditionImmunity: auto.conditionImmunity || '',
            damageResistance: auto.damage_resistance || [],
            saveAdvantage: auto.save_advantage || [],
            hasAutomation: true
        }
    },

    'holy_nimbus_radiant_damage': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'holy_nimbus_radiant_damage',
            damageExpression: auto.damageExpression || '',
            range: auto.range || '',
            casting_time: auto.casting_time || '',
            hasAutomation: true
        }
    },

    'umbral_sight': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'umbral_sight',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'supreme_sneak': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'supreme_sneak',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'otherworldly_glamour': (feature, _playerStats) => {
        return {
            type: 'passive_buff',
            name: feature.name,
            effect: 'otherworldly_glamour',
            hasAutomation: true
        }
    },

    'create_thrall_temp_hp': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'create_thrall_temp_hp',
            name: feature.name,
            tempHpExpression: auto.tempHpExpression || '',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'ritual_spells': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'ritual_spells',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'potent_cantrip': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'potent_cantrip',
            name: feature.name,
            effect: 'potent_cantrip',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'soulstitch_spells': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'soulstitch_spells',
            name: feature.name,
            effect: 'soulstitch_spells',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'empowered_evocation': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'empowered_evocation',
            name: feature.name,
            effect: 'empowered_evocation',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'concentration_disadvantage_on_damage_dealt': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'concentration_disadvantage_on_damage_dealt',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'tavern_brawler_reroll_ones': (feature, _playerStats) => {
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'tavern_brawler_reroll_ones',
            casting_time: 'passive',
            hasAutomation: true
        }
    },

    'tavern_brawler_push': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'tavern_brawler_push',
            oncePerTurn: !!auto.oncePerTurn,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'ignore_loading_crossbows': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'ignore_loading_crossbows',
            weapons: auto.weapons || [],
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'no_melee_disadvantage_crossbows': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'no_melee_disadvantage_crossbows',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    }
}
