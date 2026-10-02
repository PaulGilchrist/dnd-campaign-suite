import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import storage from '../../services/ui/storage.js'
import { CONDITIONS } from '../../services/combat/conditions/conditionUtils.js'
import { addCondition } from '../../services/combat/conditions/conditionSaveService.js'
import { getAuraConditionImmunities } from '../../services/combat/auras/auraConditionImmunity.js'
import { addConcentration } from '../../services/combat/concentration/concentrationService.js'
import { logConditionEvent } from '../../services/encounters/combatLoggingService.js'
import { cloneDeep } from 'lodash'

// CLA-019: aura-granted condition immunities (Aura of Courage) gate the GM add seam —
// addCondition suppresses + logs when the target is covered by an in-range aura.
async function applyConditionTabEffect({ combatSummary, campaignName, characters, setCombatSummary, data }) {
    const conditionDef = CONDITIONS.find(c => c.key === data.conditionKey)
    if (!conditionDef) return false
    const targetCharacter = characters.find(c => c.name === data.target || c.name.startsWith(data.target + ' '))
    const targetStats = targetCharacter?.computedStats || targetCharacter
    const aura = await getAuraConditionImmunities({ targetName: data.target, characters })
    const result = addCondition({ combatSummary, creatureName: data.target, conditionDef, dc: data.dc, ability: data.ability, getRuntimeValue, setRuntimeValue, campaignName, playerStats: targetStats, auraImmunities: aura.immunities, auraImmunitySources: aura.immunitySources })
    if (result?.suppressed) return 'suppressed'
    storage.set('combatSummary', combatSummary, campaignName)
    setCombatSummary(cloneDeep(combatSummary))
    logConditionEvent({ campaignName, action: 'applied', creatureName: data.target, conditionLabel: conditionDef.label, dc: data.dc, ability: data.ability })
    return true
}

function buildEffectEntry(data) {
    const effectEntry = { target: data.target, effect: data.effectKey }
    if (data.source) effectEntry.source = data.source
    if (data.value !== undefined) effectEntry.value = data.value
    if (data.ability) effectEntry.ability = data.ability
    if (data.dc !== undefined) {
        effectEntry.saveDc = data.dc
        effectEntry.saveAbility = data.ability || 'wis'
    }
    if (data.notes) effectEntry.notes = data.notes
    return effectEntry
}

function applyEffectTabEntry(campaignName, data) {
    const effectEntry = buildEffectEntry(data)
    const existing = getRuntimeValue('campaign', 'targetEffects') || []
    const filtered = existing.filter(te => !(te.target === data.target && te.effect === data.effectKey))
    setRuntimeValue('campaign', 'targetEffects', [...filtered, effectEntry], campaignName)
    logConditionEvent({ campaignName, action: 'target-effect-applied', creatureName: data.target, conditionLabel: data.effectKey, dc: data.dc, ability: data.ability })
}

function isRaging(target, campaignName) {
    const targetBuffs = getRuntimeValue(target, 'activeBuffs', campaignName)
    return Array.isArray(targetBuffs) && targetBuffs.some(b => b.name === 'Rage')
}

function applyConcentrationTabEffect({ combatSummary, campaignName, setCombatSummary, data }) {
    addConcentration(combatSummary, data.target, data.spellName, data.dc)
    storage.set('combatSummary', combatSummary, campaignName)
    setCombatSummary(cloneDeep(combatSummary))
    logConditionEvent({ campaignName, action: 'concentration-started', creatureName: data.target, conditionLabel: `Concentration: ${data.spellName}`, dc: data.dc, ability: 'con' })
}

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
    const handleApplyEffect = async function handleApplyEffect(tab, data) {
        if (!combatSummary) return

        if (tab === 'conditions') {
            const outcome = await applyConditionTabEffect({ combatSummary, campaignName, characters, setCombatSummary, data })
            if (outcome === 'suppressed') {
                setEffectAdderTarget(null)
                return
            }
            if (!outcome) return
        } else if (tab === 'effects') {
            applyEffectTabEntry(campaignName, data)
        } else if (tab === 'concentration') {
            if (isRaging(data.target, campaignName)) {
                setEffectAdderTarget(null)
                return
            }
            applyConcentrationTabEffect({ combatSummary, campaignName, setCombatSummary, data })
        }

        setEffectAdderTarget(null)
    }

    return {
        handleApplyEffect,
    }
}
