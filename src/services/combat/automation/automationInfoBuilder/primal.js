export const primalHandlers = {
    'primal_companion_summon': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'primal_companion_summon',
            name: feature.name,
            action: auto.action || 'bonus_action',
            companionTypes: auto.companionTypes || [],
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'primal_companion_dodge': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'primal_companion_dodge',
            name: feature.name,
            effect: auto.effect || 'companion_dodge_default',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'primal_companion_command': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'primal_companion_command',
            name: feature.name,
            action: auto.action || 'action',
            commandType: auto.commandType || 'beasts_strike',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'primal_companion_restore': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'primal_companion_restore',
            name: feature.name,
            action: auto.action || 'action',
            range: auto.range || '5_ft',
            spellSlotCost: !!auto.spellSlotCost,
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'primal_companion_bonus_action_command': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'primal_companion_bonus_action_command',
            name: feature.name,
            commandActions: auto.commandActions || [],
            forceDamageOption: !!auto.forceDamageOption,
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'primal_companion_double_strike': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'primal_companion_double_strike',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'primal_companion_spell_share': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'primal_companion_spell_share',
            name: feature.name,
            range: auto.range || '30_ft',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    }
}
