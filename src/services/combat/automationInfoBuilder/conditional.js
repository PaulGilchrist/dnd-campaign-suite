export const conditionalHandlers = {
    'conditional_advantage': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'conditional_advantage',
            name: feature.name,
            target: auto.target || 'saving_throw',
            condition: auto.condition || '',
            effect: auto.effect || 'advantage',
            abilities: auto.abilities || [],
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            hasAutomation: true
        }
    },

    'conditional_disadvantage': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'conditional_disadvantage',
            name: feature.name,
            target: auto.target || 'attack_roll',
            condition: auto.condition || '',
            effect: auto.effect || 'disadvantage',
            abilities: auto.abilities || [],
            hasAutomation: true
        }
    },

    'conditional_replacement': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'conditional_replacement',
            name: feature.name,
            target: auto.target || 'saving_throw',
            saveType: auto.saveType || '',
            condition: auto.condition || '',
            effect: auto.effect || '',
            replacementAbility: auto.replacementAbility || '',
            hasAutomation: true
        }
    },

    'condition_immunity_while_active': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'condition_immunity_while_active',
            name: feature.name,
            target: auto.target || 'self',
            immunities: auto.immunities || [],
            requiresActive: auto.requiresActive || '',
            hasAutomation: true
        }
    },

    'evasion': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'evasion',
            name: feature.name,
            saveType: auto.saveType || 'DEX',
            shareable: !!auto.shareable,
            shareRange: auto.shareRange || 0,
            hasAutomation: true
        }
    },

    'save_proficiency': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'save_proficiency',
            name: feature.name,
            saveType: auto.saveType || '',
            fallbackTypes: auto.fallbackTypes || [],
            hasAutomation: true
        }
    },

    'passive_rule': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: auto.effect || '',
            bonusExpression: auto.bonusExpression || '',
            criticalRange: auto.criticalRange || '',
            spells: auto.spells || [],
            riderSave: auto.riderSave || null,
            primalKnowledge: auto.skills || [],
            casting_time: auto.casting_time || '',
            cost: auto.cost || 0,
            resource: auto.resource || '',
            resistanceTypes: auto.resistanceTypes || [],
            duration: auto.duration || '',
            endsOnCondition: auto.endsOnCondition || '',
            hasAutomation: true
        }
    }
}
