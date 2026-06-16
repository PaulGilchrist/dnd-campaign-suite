import { getSaveDc } from '../automationExpressions.js'

export const combatSuperiorityHandlers = {
    'combat_superiority': (feature, playerStats) => {
        const auto = feature.automation
        const saveAbility = auto.saveAbility || 'STR'
        const prof = playerStats.proficiency || 0
        const saveDc = auto.saveDc === 'ability'
            ? getSaveDc(playerStats, saveAbility, prof)
            : auto.saveDc || 10
        return {
            type: 'combat_superiority',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc,
            saveAbility,
            dieExpression: auto.dieExpression || 'superiority_die',
            usesMax: auto.uses_max || 4,
            usesRecharge: auto.recharge || 'short_rest',
            options: auto.options || [],
            oncePerTurn: !!auto.oncePerTurn,
            chooseOne: !!auto.chooseOne,
            hasAutomation: true
        }
    },

    'tactical_mind': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'tactical_mind',
            name: feature.name,
            bonusExpression: auto.bonusExpression || '',
            hasAutomation: true
        }
    },

    'know_enemy': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'know_enemy',
            name: feature.name,
            range: auto.range || '30_ft',
            usesMax: auto.uses_max || 4,
            hasAutomation: true
        }
    }
}
