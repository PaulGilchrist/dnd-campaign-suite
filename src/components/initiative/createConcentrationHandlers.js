import { cloneDeep } from 'lodash'
import storage from '../../services/ui/storage.js'
import { rollConcentrationSave, breakConcentration, buildConcentrationPopup } from '../../services/combat/concentration/concentrationService.js'
import { cleanupConcentrationEffects } from '../../services/combat/concentration/concentrationService.js'
import { stripSummonedFromCombatSummary } from '../../services/combat/summons/summonedCreatureService.js'
import { logConcentrationSave } from '../../services/encounters/combatLoggingService.js'
import { logConditionEvent } from '../../services/encounters/combatLoggingService.js'

function findCharacterByName(characters, name) {
    return characters.find(c => c.name === name || c.name.startsWith(name + ' ')) || null
}

function getSaveModifiers(character) {
    return character?.saveModifiers || character?.computedStats?.saveModifiers
}

function resolveConcentrationBreaker(saveModifiers) {
    return saveModifiers?.some(mod =>
        mod.condition === 'concentration_breaker' && mod.effect === 'disadvantage'
    ) ?? false
}

function collectAdvantageSources(saveModifiers) {
    const advantageSources = []
    if (!saveModifiers) return advantageSources
    saveModifiers.forEach(mod => {
        const qualifies = mod.target === 'concentration_saving_throws' ||
            (mod.target === 'saving_throw' && mod.condition === 'concentration_spell_damage' && mod.effect === 'advantage' && mod.abilities && mod.abilities.includes('Constitution'))
        if (mod.source && qualifies && !advantageSources.includes(mod.source)) {
            advantageSources.push(mod.source)
        }
    })
    return advantageSources
}

function resolveSaveMode(hasConcentrationBreaker, advantageSources) {
    if (hasConcentrationBreaker) return 'disadvantage'
    return advantageSources.length > 0 ? 'advantage' : 'normal'
}

/**
 * Creates concentration-related handlers for the initiative component.
 */
export function createConcentrationHandlers({
    combatSummary,
    campaignName,
    characters,
    campaignNpcs,
    mapName,
    setConditionPopup,
    setCombatSummary,
}) {
    const handleRollConcentrationSave = async function handleRollConcentrationSave(creatureName) {
        if (!combatSummary) return
        const creature = combatSummary.creatures.find(c => c.name === creatureName)
        if (!creature || !creature.concentration) return

        const concentration = creature.concentration

        const { getRuntimeValue: grv } = await import('../../hooks/runtime/useRuntimeState.js')
        const lastAttack = await grv('campaign', 'lastAttack', campaignName)
        const attackerName = lastAttack?.attackerName
        const attacker = attackerName ? findCharacterByName(characters, attackerName) : null
        const hasConcentrationBreaker = resolveConcentrationBreaker(getSaveModifiers(attacker))
        const advantageSources = collectAdvantageSources(getSaveModifiers(findCharacterByName(characters, creatureName)))

        const { roll: r1, success, bonus, bonusDetail, starryDragonFloor, displayRolls } = await rollConcentrationSave(
            creature, concentration, characters, campaignNpcs, campaignName, mapName, (name) => name, hasConcentrationBreaker
        )

        if (!success) {
            creature.concentration = null
            // SP-114: drop summons from THIS reference before persisting so the
            // write-back cannot resurrect creatures cleanupConcentrationEffects removes.
            stripSummonedFromCombatSummary(combatSummary, creatureName)
        }

        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))

        setConditionPopup(buildConcentrationPopup(r1, bonus, bonusDetail, concentration.spell, concentration.dc, success, starryDragonFloor, displayRolls))

        const mode = resolveSaveMode(hasConcentrationBreaker, advantageSources)
        logConcentrationSave(campaignName, creatureName, r1, bonus, bonusDetail, concentration.spell, concentration.dc, success, mode, advantageSources.length > 0 ? advantageSources : undefined)

        if (!success) {
            cleanupConcentrationEffects(creatureName, concentration.spell, campaignName)
        }
    }

    const handleBreakConcentration = function handleBreakConcentration(creatureName) {
        if (!combatSummary) return
        const spell = breakConcentration(combatSummary, creatureName)
        if (!spell) return
        stripSummonedFromCombatSummary(combatSummary, creatureName)
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
        logConditionEvent(campaignName, 'removed', creatureName, `Concentration: ${spell}`)
        cleanupConcentrationEffects(creatureName, spell, campaignName)
    }

    return {
        handleRollConcentrationSave,
        handleBreakConcentration,
    }
}
