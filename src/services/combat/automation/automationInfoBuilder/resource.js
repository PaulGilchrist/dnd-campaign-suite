import { evaluateAutoExpression } from '../automationExpressions.js'

export const resourceHandlers = {
    'resource_pool': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'resource_pool',
            name: feature.name,
            resource: auto.resource || '',
            uses_expression: auto.uses_expression || '',
            recharge_short_rest: auto.recharge_short_rest || '',
            recharge_long_rest: auto.recharge_long_rest || '',
            conversion: auto.conversion || '',
            reverseConversion: auto.reverseConversion || '',
            reverseRecharge: auto.reverseRecharge || '',
            conversionRate: auto.conversionRate || '',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'resource_restoration': (feature, _playerStats) => {
        const auto = feature.automation
        const restoreAmount = auto.restore_expression
            ? evaluateAutoExpression(auto.restore_expression, _playerStats)
            : 0
        return {
            type: 'resource_restoration',
            name: feature.name,
            trigger: auto.trigger || 'short_rest',
            casting_time: auto.casting_time || 'passive',
            restore_amount: restoreAmount,
            restore_expression: auto.restore_expression || '',
            resourceKey: auto.resourceKey || '',
            uses_max: auto.uses_max ?? 1,
            recharge: auto.recharge || 'long_rest',
            hasAutomation: true
        }
    }
}
