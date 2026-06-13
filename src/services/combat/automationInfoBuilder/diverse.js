export const diverseHandlers = {
    'divine_intervention': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'divine_intervention',
            name: feature.name,
            recharge: auto.recharge || 'long_rest',
            upgradeTo: auto.upgradeTo || '',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'extra_action': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'extra_action',
            name: feature.name,
            uses: auto.uses || 1,
            recharge: auto.recharge || 'short_rest',
            oncePerTurn: !!auto.oncePerTurn,
            oncePerCombat: !!auto.oncePerCombat,
            firstRoundOnly: !!auto.firstRoundOnly,
            resourceKey: feature.name.toLowerCase().replace(/\s+/g, '') + 'Uses',
            hasAutomation: true
        }
    },

    'font_of_magic': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'font_of_magic',
            name: feature.name,
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'font_of_inspiration': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'font_of_inspiration',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'meta': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'meta',
            name: feature.name,
            effect: auto.effect || '',
            hasAutomation: true
        }
    },

    'jack_of_all_trades': (feature, _playerStats) => {
        return {
            type: 'jack_of_all_trades',
            name: feature.name,
            hasAutomation: true
        }
    },

    'reliable_talent': (feature, _playerStats) => {
        return {
            type: 'reliable_talent',
            name: feature.name,
            hasAutomation: true
        }
    },

    'divine_order': (feature, _playerStats) => {
        return {
            type: 'divine_order',
            name: feature.name,
            hasAutomation: true
        }
    }
}
