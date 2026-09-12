import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import storage from '../../services/ui/storage.js'
import { CONDITIONS } from '../../services/combat/conditions/conditionUtils.js'
import { addCondition } from '../../services/combat/conditions/conditionSaveService.js'
import { addConcentration } from '../../services/combat/concentration/concentrationService.js'
import { logConditionEvent } from '../../services/encounters/combatLoggingService.js'
import { cloneDeep } from 'lodash'

/**
 * Creates the effect adder handlers for the initiative component.
 */
export function createEffectAdderHandlers({
    campaignName,
    characters,
    combatSummary,
    setEffectAdderTarget,
    setCombatSummary,
}) {
    const handleApplyEffect = function handleApplyEffect(tab, data) {
        if (!combatSummary) return

        if (tab === 'conditions') {
            const conditionDef = CONDITIONS.find(c => c.key === data.conditionKey)
            if (!conditionDef) return
            const targetCharacter = characters.find(c => c.name === data.target || c.name.startsWith(data.target + ' '))
            const targetStats = targetCharacter?.computedStats || targetCharacter
            addCondition({ combatSummary, creatureName: data.target, conditionDef, dc: data.dc, ability: data.ability, getRuntimeValue, setRuntimeValue, campaignName, playerStats: targetStats })
            storage.set('combatSummary', combatSummary, campaignName)
            setCombatSummary(cloneDeep(combatSummary))
            logConditionEvent(campaignName, 'applied', data.target, conditionDef.label, data.dc, data.ability)
        } else if (tab === 'effects') {
            const effectEntry = { target: data.target, effect: data.effectKey }
            if (data.source) effectEntry.source = data.source
            if (data.value !== undefined) effectEntry.value = data.value
            if (data.ability) effectEntry.ability = data.ability
            if (data.dc !== undefined) {
                effectEntry.saveDc = data.dc
                effectEntry.saveAbility = data.ability || 'wis'
            }
            if (data.notes) effectEntry.notes = data.notes
            const existing = getRuntimeValue('campaign', 'targetEffects') || []
            const filtered = existing.filter(te => !(te.target === data.target && te.effect === data.effectKey))
            setRuntimeValue('campaign', 'targetEffects', [...filtered, effectEntry], campaignName)
            logConditionEvent(campaignName, 'target-effect-applied', data.target, data.effectKey, data.dc, data.ability)
        } else if (tab === 'concentration') {
            const targetBuffs = getRuntimeValue(data.target, 'activeBuffs', campaignName)
            if (Array.isArray(targetBuffs) && targetBuffs.some(b => b.name === 'Rage')) {
                setEffectAdderTarget(null)
                return
            }
            addConcentration(combatSummary, data.target, data.spellName, data.dc)
            storage.set('combatSummary', combatSummary, campaignName)
            setCombatSummary(cloneDeep(combatSummary))
            logConditionEvent(campaignName, 'concentration-started', data.target, `Concentration: ${data.spellName}`, data.dc, 'con')
        }

        setEffectAdderTarget(null)
    }

    return {
        handleApplyEffect,
    }
}
