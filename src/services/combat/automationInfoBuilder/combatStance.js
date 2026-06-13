export const combatStanceHandlers = {
    'combat_stance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'combat_stance',
            name: feature.name,
            effect: auto.effect || '',
            damageBonusExpression: auto.damageBonusExpression || '',
            resistanceTypes: auto.resistanceTypes || [],
            advantages: auto.advantages || [],
            options: auto.options || [],
            duration: auto.duration || '',
            resourceKey: auto.resourceKey || 'ragePoints',
            uses: auto.uses || 0,
            flySpeed: auto.flySpeed || null,
            reactionSave: auto.reactionSave || null,
            blocksSpellcasting: auto.blocksSpellcasting || false,
            hasAutomation: true
        }
    }
}
