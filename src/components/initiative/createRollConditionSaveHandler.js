import { cloneDeep } from 'lodash'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import storage from '../../services/ui/storage.js'
import { rollConditionSave, removeCondition, buildConditionPopup } from '../../services/combat/conditions/conditionSaveService.js'
import { removeForcecageEffect } from '../../services/automation/handlers/spells/forcecageHandler.js'
import { removeMazeEffect } from '../../services/automation/handlers/spells/mazeHandler.js'
import { removeSlowEffectsForTarget } from '../../services/combat/conditions/slowEffects.js'
import { getAbilityLabel } from '../../services/combat/conditions/conditionUtils.js'
import { logConditionSave } from '../../services/encounters/combatLoggingService.js'
import * as logService from '../../services/ui/logService.js'

function logEntry(campaignName, entry) {
    return logService.addEntry(campaignName, entry).catch((e) => { console.error("[initiativeConditionSave:log-error]", e); })
}

function findTargetEffect(creatureName, effect) {
    return (getRuntimeValue('campaign', 'targetEffects') || []).find(
        te => te.effect === effect && te.target === creatureName
    )
}

function removeTargetEffect(creatureName, effect, campaignName) {
    const remainingEffects = (getRuntimeValue('campaign', 'targetEffects') || []).filter(
        te => !(te.target === creatureName && te.effect === effect)
    )
    setRuntimeValue('campaign', 'targetEffects', remainingEffects, campaignName)
}

async function handleSlowSuccess({ creatureName, campaignName }) {
    // SP-109: Slow ends on itself on a successful repeat save — strip its target effects
    if (removeSlowEffectsForTarget(creatureName, campaignName)) {
        await logEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: creatureName,
            condition: 'Slow effects',
            reason: 'Slow (successful repeat save)',
            note: `${creatureName} succeeded on the WIS repeat save; Slow ends and its target effects are removed.`,
            timestamp: Date.now(),
        })
    }
}

async function handleOttoSuccess({ combatSummary, creatureName, condition, campaignName }) {
    const danceEffect = findTargetEffect(creatureName, 'ottos_irresistible_dance')
    if (!danceEffect) return
    removeCondition(combatSummary, creatureName, { key: 'speed_zero' }, getRuntimeValue, setRuntimeValue, campaignName)
    removeTargetEffect(creatureName, 'ottos_irresistible_dance', campaignName)
    await logEntry(campaignName, {
        type: 'save_result',
        characterName: danceEffect.source,
        rollType: 'save-ottos-dance',
        targetName: creatureName,
        saveDc: condition.dc,
        saveType: 'WIS',
        success: true,
        description: `${creatureName} succeeded on WIS save against Otto's Irresistible Dance. The spell ends; Charmed and Speed 0 removed.`,
    })
    await logEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: creatureName,
        condition: 'Charmed, Speed 0',
        reason: "Otto's Irresistible Dance (successful reroll)",
        note: `${creatureName} succeeded on the WIS reroll; Otto's Irresistible Dance ends.`,
        timestamp: Date.now(),
    })
}

async function handleTashasLaughterSuccess({ combatSummary, creatureName, condition, campaignName }) {
    const laughterEffect = findTargetEffect(creatureName, 'tashas_hideous_laughter')
    if (!laughterEffect) return
    removeCondition(combatSummary, creatureName, { key: 'prone' }, getRuntimeValue, setRuntimeValue, campaignName)
    removeCondition(combatSummary, creatureName, { key: 'incapacitated' }, getRuntimeValue, setRuntimeValue, campaignName)
    removeTargetEffect(creatureName, 'tashas_hideous_laughter', campaignName)
    await logEntry(campaignName, {
        type: 'save_result',
        characterName: laughterEffect.source,
        rollType: 'save-tashas-laughter',
        targetName: creatureName,
        saveDc: condition.dc,
        saveType: 'WIS',
        success: true,
        description: `${creatureName} succeeded on WIS save against Tasha's Hideous Laughter. The spell ends; Prone and Incapacitated removed.`,
    })
    await logEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: creatureName,
        condition: 'Prone, Incapacitated',
        reason: "Tasha's Hideous Laughter (successful reroll)",
        note: `${creatureName} succeeded on the WIS reroll; Tasha's Hideous Laughter ends.`,
        timestamp: Date.now(),
    })
}

async function handleConfusionSuccess({ combatSummary, creatureName, condition, campaignName }) {
    const confusionEffect = findTargetEffect(creatureName, 'confusion')
    if (!confusionEffect) return
    removeCondition(combatSummary, creatureName, { key: 'charmed' }, getRuntimeValue, setRuntimeValue, campaignName)
    removeCondition(combatSummary, creatureName, { key: 'speed_zero' }, getRuntimeValue, setRuntimeValue, campaignName)
    removeTargetEffect(creatureName, 'confusion', campaignName)
    await logEntry(campaignName, {
        type: 'save_result',
        characterName: confusionEffect.source,
        rollType: 'save-confusion',
        targetName: creatureName,
        saveDc: condition.dc,
        saveType: 'WIS',
        success: true,
        description: `${creatureName} succeeded on WIS save against Confusion. The spell ends; Charmed and Speed 0 removed.`,
    })
    await logEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: creatureName,
        condition: 'Charmed, Speed 0',
        reason: 'Confusion (successful reroll)',
        note: `${creatureName} succeeded on the WIS reroll; Confusion ends.`,
        timestamp: Date.now(),
    })
}

async function handleForcecageSuccess({ creatureName, condition, campaignName }) {
    const forcecageEffect = findTargetEffect(creatureName, 'forcecage')
    if (!forcecageEffect) return
    removeForcecageEffect(creatureName, forcecageEffect.source, campaignName)
    await logEntry(campaignName, {
        type: 'save_result',
        characterName: forcecageEffect.source,
        rollType: 'save-forcecage',
        targetName: creatureName,
        saveDc: condition.dc,
        saveType: 'CHA',
        success: true,
        description: `${creatureName} succeeded on CHA save against Forcecage and escaped the prison using teleportation or interplanar travel.`,
    })
    await logEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: creatureName,
        condition: 'Forcecaged',
        reason: 'Forcecage escape (successful CHA save)',
        note: `${creatureName} succeeded on the CHA reroll; the Forcecage no longer traps them.`,
        timestamp: Date.now(),
    })
}

async function handleMazeSuccess({ creatureName, condition, campaignName, r1, bonus }) {
    const mazeEffect = findTargetEffect(creatureName, 'maze')
    if (!mazeEffect) return
    removeMazeEffect(creatureName, mazeEffect.source, campaignName)
    setRuntimeValue(creatureName, 'mazeData', null, campaignName)
    const storedConditions = getRuntimeValue(creatureName, 'activeConditions') || []
    const conditions = Array.isArray(storedConditions) ? storedConditions : []
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'incapacitated')
    setRuntimeValue(creatureName, 'activeConditions', filtered, campaignName)
    await logEntry(campaignName, {
        type: 'save_result',
        characterName: mazeEffect.source,
        rollType: 'save-maze-escape',
        targetName: creatureName,
        saveDc: condition.dc,
        saveType: 'INT',
        success: true,
        description: `${creatureName} succeeded on INT (Investigation) check (${r1} + ${bonus} = ${r1 + bonus} vs DC ${condition.dc}) and escaped the Maze.`,
    })
    await logEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: creatureName,
        condition: 'Incapacitated',
        reason: 'Maze escape (successful INT Investigation check)',
        note: `${creatureName} escaped the Maze and is no longer Incapacitated.`,
        timestamp: Date.now(),
    })
}

async function handleEnfeeblementSuccess({ combatSummary, creatureName, condition, campaignName }) {
    const rayEffect = findTargetEffect(creatureName, 'ray_of_enfeeble_debuff')
    if (!rayEffect) return
    removeTargetEffect(creatureName, 'ray_of_enfeeble_debuff', campaignName)
    const caster = combatSummary.creatures.find(c => c.name === rayEffect.source)
    if (caster && caster.concentration && caster.concentration.spell === 'Ray of Enfeeblement') {
        caster.concentration = null
    }
    await logEntry(campaignName, {
        type: 'save_result',
        characterName: rayEffect.source,
        rollType: 'save-ray-of-enfeeblement',
        targetName: creatureName,
        saveDc: condition.dc,
        saveType: 'CON',
        success: true,
        description: `${creatureName} succeeded on CON save against Ray of Enfeeblement. The spell ends; the enfeeblement debuff is removed.`,
    })
    await logEntry(campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: creatureName,
        condition: 'Ray of Enfeeblement debuff',
        reason: 'Ray of Enfeeblement (successful repeat save)',
        note: `${creatureName} succeeded on the CON repeat save; Ray of Enfeeblement save ends.`,
        timestamp: Date.now(),
    })
}

async function handleEnfeeblementFailure({ creatureName, campaignName }) {
    if (!findTargetEffect(creatureName, 'ray_of_enfeeble_debuff')) return
    await logEntry(campaignName, {
        type: 'condition',
        action: 'kept',
        characterName: creatureName,
        condition: 'Ray of Enfeeblement debuff',
        reason: 'Ray of Enfeeblement (failed repeat save)',
        note: `${creatureName} failed the CON repeat save; Enfeeblement continues (-1d8 damage rolls, Disadvantage on STR checks).`,
        timestamp: Date.now(),
    })
}

// Ordered success cleanups — evaluated in declaration order on a successful save.
const SUCCESS_CLEANUPS = [
    { matches: (key) => key === 'slow', run: handleSlowSuccess },
    { matches: (key) => key === 'charmed', run: handleOttoSuccess },
    { matches: (key) => key === 'prone' || key === 'incapacitated', run: handleTashasLaughterSuccess },
    { matches: (key) => key === 'confused', run: handleConfusionSuccess },
    { matches: (key) => key === 'forcecaged', run: handleForcecageSuccess },
    { matches: (key) => key === 'incapacitated', run: handleMazeSuccess },
    { matches: (key) => key === 'ray_of_enfeeble_debuff', run: handleEnfeeblementSuccess },
]

/**
 * Creates the handleRollConditionSave handler.
 */
export function createRollConditionSaveHandler({
    combatSummary,
    campaignName,
    characters,
    campaignNpcs,
    mapName,
    setConditionPopup,
    setCombatSummary,
}) {
    return async function handleRollConditionSave(creatureName, condition) {
        if (!combatSummary) return
        const creature = combatSummary.creatures.find(c => c.name === creatureName)
        if (!creature) return

        const { roll: r1, success, bonus, bonusDetail, rolls, starryDragonFloor } = await rollConditionSave(
            creature, condition, characters, campaignNpcs, campaignName, mapName, (name) => name
        )

        const conditionKey = String(condition.key).toLowerCase()
        const ctx = { combatSummary, creatureName, condition, campaignName, r1, bonus }

        if (success) {
            removeCondition(combatSummary, creatureName, condition, getRuntimeValue, setRuntimeValue, campaignName)
            for (const cleanup of SUCCESS_CLEANUPS) {
                if (cleanup.matches(conditionKey)) await cleanup.run(ctx)
            }
        } else if (conditionKey === 'ray_of_enfeeble_debuff') {
            await handleEnfeeblementFailure(ctx)
        }

        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))

        setConditionPopup(buildConditionPopup(r1, bonus, bonusDetail, getAbilityLabel(condition.ability), condition.label, condition.dc, success, rolls, rolls && rolls.length > 1, starryDragonFloor))

        // Pass the full dice array so advantage rolls log both dice + mode 'advantage' (CLA-209)
        logConditionSave(campaignName, creatureName, Array.isArray(rolls) && rolls.length > 1 ? rolls : r1, bonus, bonusDetail, condition.label, getAbilityLabel(condition.ability), condition.dc, success)
    }
}
