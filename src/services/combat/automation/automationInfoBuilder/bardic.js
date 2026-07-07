import { evaluateAutoExpression } from '../automationExpressions.js'

export const bardicHandlers = {
    'bardic_inspiration': (feature, playerStats) => {
        const auto = feature.automation
        const usesMax = auto.uses_expression
            ? evaluateAutoExpression(auto.uses_expression, playerStats)
            : 0
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        const dieSize = classLevel?.bardic_die || classLevel?.class_specific?.bardic_inspiration_die || 6;
        return {
            type: 'bardic_inspiration',
            name: feature.name,
            range: auto.range || '60_ft',
            action: auto.action || 'bonus_action',
            usesMax,
            usesRecharge: auto.recharge || 'long_rest',
            dieSize,
            hasAutomation: true
        }
    },

    'bardic_inspiration_defense': (feature, _playerStats) => {
        return {
            type: 'bardic_inspiration_defense',
            name: feature.name,
            hasAutomation: true,
            casting_time: '1 reaction',
        }
    },

    'bardic_inspiration_offense': (feature, _playerStats) => {
        return {
            type: 'bardic_inspiration_offense',
            name: feature.name,
            hasAutomation: true,
            casting_time: '1 reaction',
        }
    }
}
