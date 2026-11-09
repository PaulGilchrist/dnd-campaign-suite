import { cloneDeep } from 'lodash'
import storage from '../../services/ui/storage.js'
import { removeCondition } from '../../services/combat/conditions/conditionSaveService.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { logConditionEvent } from '../../services/encounters/combatLoggingService.js'
import { isSecondTurnEntry } from '../../services/combat/thiefsReflexesService.js'

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
        const row = combatSummary.creatures.find(c => c.name === creatureName)
        // CLA-360 law (mirrors openEffectAdder c5883e4a4 / openAllyEditor): a
        // structural (Second Turn) row card DISPLAYS the holder's conditions
        // (buildDisplayCreature resolves via holderName), so its badge × must
        // break the HOLDER's condition. Removing by the synthetic name writes a
        // false 'broken' audit naming a creature with no character file and
        // materializes a phantom {activeConditions:[]} change-data bucket while
        // the holder's real condition silently survives.
        const subjectName = row && isSecondTurnEntry(row) && row.holderName ? row.holderName : creatureName
        const subject = subjectName === creatureName ? row : combatSummary.creatures.find(c => c.name === subjectName)
        if (subject?.conditions) {
            subject.conditions = subject.conditions.filter(c => {
                if (!c || typeof c !== 'object') return true
                return String(c.key || c).toLowerCase() !== conditionKey
            })
        }
        removeCondition({ combatSummary, creatureName: subjectName, condition, getRuntimeValue, setRuntimeValue, campaignName })
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
        logConditionEvent({ campaignName, action: 'broken', creatureName: subjectName, conditionLabel: condition.label })
    }
}
