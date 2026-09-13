import { cloneDeep } from 'lodash'
import storage from '../../services/ui/storage.js'
import { removeCondition } from '../../services/combat/conditions/conditionSaveService.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { logConditionEvent } from '../../services/encounters/combatLoggingService.js'

/**
 * Creates the auto-break condition handler for the initiative component.
 */
export function createAutoBreakConditionHandler({
    isLocalhost,
    combatSummary,
    campaignName,
    setCombatSummary,
}) {
    return function handleAutoBreakCondition(creatureName, condition) {
        if (!isLocalhost || !combatSummary) return
        const conditionKey = String(condition.key || condition).toLowerCase()
        const creature = combatSummary.creatures.find(c => c.name === creatureName)
        if (creature?.conditions) {
            creature.conditions = creature.conditions.filter(c => {
                if (!c || typeof c !== 'object') return true
                return String(c.key || c).toLowerCase() !== conditionKey
            })
        }
        removeCondition({ combatSummary, creatureName, condition, getRuntimeValue, setRuntimeValue, campaignName })
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
        logConditionEvent({ campaignName, action: 'broken', creatureName, conditionLabel: condition.label })
    }
}
