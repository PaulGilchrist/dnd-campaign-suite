export const passiveHandlers = {
    'passive_buff': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_buff',
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
    }
}
