export const initiativeHandlers = {
    'initiative_action': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'initiative_action',
            name: feature.name,
            effect: auto.effect || '',
            healExpression: auto.healExpression || '',
            trigger: auto.trigger || 'roll_initiative',
            uses: auto.uses ?? 1,
            usesMax: auto.uses ?? 1,
            recharge: auto.recharge || 'long_rest',
            resourceCost: auto.resourceCost || '',
            resourceKey: feature.name.toLowerCase().replace(/\s+/g, '') + 'Uses',
            hasAutomation: true
        }
    }
}
