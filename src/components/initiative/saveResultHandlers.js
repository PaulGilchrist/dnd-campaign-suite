import { cloneDeep } from 'lodash'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { clearFleshToStonePrompt } from '../../services/combat/conditions/savePromptService.js'
import * as logService from '../../services/ui/logService.js'

/**
 * Creates a handler for Flesh to Stone save results.
 */
export function createFleshToStoneHandler(campaignName, combatSummary, setCombatSummary) {
    return async function handler(e) {
        const { campaignName: evtCampaign, targetName, result } = e.detail
        if (evtCampaign !== campaignName || !combatSummary || !result) return

        const creature = combatSummary.creatures.find(c => c.name === targetName)
        if (!creature) return

        const saveTrackingKey = `_fleshToStone_${targetName.replace(/\s+/g, '_')}`
        const saveData = getRuntimeValue('campaign', saveTrackingKey, campaignName)
        if (!saveData) return

        if (result.success) {
            const newSuccesses = saveData.successes + 1
            if (newSuccesses >= 3) {
                const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || []
                const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained')
                setRuntimeValue(targetName, 'activeConditions', filtered, campaignName)
                const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || []
                const cleanedEffects = allTargetEffects.filter(te => !(te.target === targetName && te.effect === 'flesh_to_stone' && te.source === saveData.casterName))
                setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName)
                setRuntimeValue('campaign', saveTrackingKey, null, campaignName)
                clearFleshToStonePrompt(campaignName, targetName)
                await logService.addEntry(campaignName, {
                    type: 'save_result',
                    characterName: saveData.casterName,
                    rollType: 'save-flesh-to-stone',
                    targetName,
                    saveDc: saveData.dc,
                    saveType: 'CON',
                    success: true,
                    description: `${targetName} collected 3 successful saves against Flesh to Stone. The spell ends.`,
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
                await logService.addEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: 'Restrained',
                    reason: 'Flesh to Stone (3 successes)',
                    note: `${targetName} collected 3 successful saves; Restrained condition removed.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            } else {
                setRuntimeValue('campaign', saveTrackingKey, {
                    ...saveData,
                    successes: newSuccesses,
                }, campaignName)
                await logService.addEntry(campaignName, {
                    type: 'save_result',
                    characterName: saveData.casterName,
                    rollType: 'save-flesh-to-stone',
                    targetName,
                    saveDc: saveData.dc,
                    saveType: 'CON',
                    success: true,
                    description: `${targetName} succeeded on CON save against Flesh to Stone (${newSuccesses}/3 successes needed).`,
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            }
        } else {
            const newFailures = saveData.failures + 1
            if (newFailures >= 3) {
                const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || []
                const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained')
                setRuntimeValue(targetName, 'activeConditions', [...filtered, 'petrified'], campaignName)
                const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || []
                const cleanedEffects = allTargetEffects.filter(te => !(te.target === targetName && te.effect === 'flesh_to_stone' && te.source === saveData.casterName))
                setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName)
                setRuntimeValue('campaign', saveTrackingKey, null, campaignName)
                clearFleshToStonePrompt(campaignName, targetName)
                await logService.addEntry(campaignName, {
                    type: 'save_result',
                    characterName: saveData.casterName,
                    rollType: 'save-flesh-to-stone',
                    targetName,
                    saveDc: saveData.dc,
                    saveType: 'CON',
                    success: false,
                    description: `${targetName} failed 3 CON saves against Flesh to Stone and is turned to stone (Petrified).`,
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
                await logService.addEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: 'Restrained',
                    reason: 'Flesh to Stone (3 failures)',
                    note: `${targetName} collected 3 failed saves; Restrained removed, Petrified applied.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
                await logService.addEntry(campaignName, {
                    type: 'condition',
                    action: 'applied',
                    characterName: targetName,
                    condition: 'Petrified',
                    reason: 'Flesh to Stone',
                    note: `${targetName} is Petrified by Flesh to Stone after failing 3 saves.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            } else {
                setRuntimeValue('campaign', saveTrackingKey, {
                    ...saveData,
                    failures: newFailures,
                }, campaignName)
                await logService.addEntry(campaignName, {
                    type: 'save_result',
                    characterName: saveData.casterName,
                    rollType: 'save-flesh-to-stone',
                    targetName,
                    saveDc: saveData.dc,
                    saveType: 'CON',
                    success: false,
                    description: `${targetName} failed CON save against Flesh to Stone (${newFailures}/3 failures needed).`,
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            }
        }

        setCombatSummary(cloneDeep(combatSummary))
    }
}

/**
 * Creates a handler for Prismatic Spray Indigo save results.
 */
export function createPrismaticSprayIndigoHandler(campaignName, combatSummary, setCombatSummary) {
    return async function handler(e) {
        const { campaignName: evtCampaign, targetName, result } = e.detail
        if (evtCampaign !== campaignName || !combatSummary || !result) return

        const creature = combatSummary.creatures.find(c => c.name === targetName)
        if (!creature) return

        const saveTrackingKey = `_prismaticSprayIndigo_${targetName.replace(/\s+/g, '_')}`
        const saveData = getRuntimeValue('campaign', saveTrackingKey, campaignName)
        if (!saveData) return

        if (result.success) {
            const newSuccesses = saveData.successes + 1
            if (newSuccesses >= 3) {
                const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || []
                const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained')
                setRuntimeValue(targetName, 'activeConditions', filtered, campaignName)
                const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || []
                const cleanedEffects = allTargetEffects.filter(te => !(te.target === targetName && te.effect === 'prismatic_spray_indigo' && te.source === saveData.casterName))
                setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName)
                setRuntimeValue('campaign', saveTrackingKey, null, campaignName)
                await logService.addEntry(campaignName, {
                    type: 'save_result',
                    characterName: saveData.casterName,
                    rollType: 'save-prismatic-spray-indigo',
                    targetName,
                    saveDc: saveData.dc,
                    saveType: 'CON',
                    success: true,
                    description: `${targetName} collected 3 successful CON saves against Prismatic Spray (Indigo ray). Restrained ends.`,
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
                await logService.addEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: 'Restrained',
                    reason: 'Prismatic Spray Indigo (3 successes)',
                    note: `${targetName} collected 3 successful saves; Restrained condition removed.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            } else {
                setRuntimeValue('campaign', saveTrackingKey, {
                    ...saveData,
                    successes: newSuccesses,
                }, campaignName)
                await logService.addEntry(campaignName, {
                    type: 'save_result',
                    characterName: saveData.casterName,
                    rollType: 'save-prismatic-spray-indigo',
                    targetName,
                    saveDc: saveData.dc,
                    saveType: 'CON',
                    success: true,
                    description: `${targetName} succeeded on CON save against Prismatic Spray Indigo ray (${newSuccesses}/3 successes needed).`,
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            }
        } else {
            const newFailures = saveData.failures + 1
            if (newFailures >= 3) {
                const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || []
                const filtered = conditions.filter(c => String(c).toLowerCase() !== 'restrained')
                setRuntimeValue(targetName, 'activeConditions', [...filtered, 'petrified'], campaignName)
                const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || []
                const cleanedEffects = allTargetEffects.filter(te => !(te.target === targetName && te.effect === 'prismatic_spray_indigo' && te.source === saveData.casterName))
                setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName)
                setRuntimeValue('campaign', saveTrackingKey, null, campaignName)
                await logService.addEntry(campaignName, {
                    type: 'save_result',
                    characterName: saveData.casterName,
                    rollType: 'save-prismatic-spray-indigo',
                    targetName,
                    saveDc: saveData.dc,
                    saveType: 'CON',
                    success: false,
                    description: `${targetName} failed 3 CON saves against Prismatic Spray (Indigo ray) and is turned to stone (Petrified).`,
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
                await logService.addEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: 'Restrained',
                    reason: 'Prismatic Spray Indigo (3 failures)',
                    note: `${targetName} collected 3 failed saves; Restrained removed, Petrified applied.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
                await logService.addEntry(campaignName, {
                    type: 'condition',
                    action: 'applied',
                    characterName: targetName,
                    condition: 'Petrified',
                    reason: 'Prismatic Spray Indigo',
                    note: `${targetName} is Petrified by Prismatic Spray after failing 3 saves.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            } else {
                setRuntimeValue('campaign', saveTrackingKey, {
                    ...saveData,
                    failures: newFailures,
                }, campaignName)
                await logService.addEntry(campaignName, {
                    type: 'save_result',
                    characterName: saveData.casterName,
                    rollType: 'save-prismatic-spray-indigo',
                    targetName,
                    saveDc: saveData.dc,
                    saveType: 'CON',
                    success: false,
                    description: `${targetName} failed CON save against Prismatic Spray Indigo ray (${newFailures}/3 failures needed).`,
                }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            }
        }

        setCombatSummary(cloneDeep(combatSummary))
    }
}

/**
 * Creates a handler for Prismatic Spray Violet save results (banishment).
 */
export function createPrismaticSprayVioletHandler(campaignName, combatSummary, setCombatSummary) {
    return async function handler(e) {
        const { campaignName: evtCampaign, targetName, result } = e.detail
        if (evtCampaign !== campaignName || !combatSummary || !result) return

        const creature = combatSummary.creatures.find(c => c.name === targetName)
        if (!creature) return

        const saveTrackingKey = `_prismaticSprayViolet_${targetName.replace(/\s+/g, '_')}`
        const saveData = getRuntimeValue('campaign', saveTrackingKey, campaignName)
        if (!saveData) return

        if (result.success) {
            const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || []
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'blinded')
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName)
            const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || []
            const cleanedEffects = allTargetEffects.filter(te => !(te.target === targetName && te.effect === 'prismatic_spray_violet' && te.source === saveData.casterName))
            setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName)
            setRuntimeValue('campaign', saveTrackingKey, null, campaignName)
            await logService.addEntry(campaignName, {
                type: 'save_result',
                characterName: saveData.casterName,
                rollType: 'save-prismatic-spray-violet',
                targetName,
                saveDc: saveData.dc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} succeeded on WIS save against Prismatic Spray (Violet ray). Blindness ends.`,
            }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            await logService.addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Blinded',
                reason: 'Prismatic Spray Violet (WIS save success)',
                note: `${targetName} succeeded on WIS save; Blinded condition removed.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
        } else {
            // Banish the creature
            const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || []
            const filtered = conditions.filter(c => String(c).toLowerCase() !== 'blinded')
            setRuntimeValue(targetName, 'activeConditions', [...filtered, 'incapacitated'], campaignName)

            const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || []
            const cleanedEffects = allTargetEffects.filter(te => !(te.target === targetName && te.effect === 'prismatic_spray_violet' && te.source === saveData.casterName))
            const existingBanishment = cleanedEffects.filter(te => !(te.effect === 'banishment' && te.target === targetName && te.source === saveData.casterName))
            setRuntimeValue('campaign', 'targetEffects', [
                ...existingBanishment,
                {
                    effect: 'banishment',
                    target: targetName,
                    source: saveData.casterName,
                    duration: 'Concentration, up to 1 minute',
                    permanent: false,
                },
            ], campaignName)

            setRuntimeValue('campaign', saveTrackingKey, null, campaignName)

            await logService.addEntry(campaignName, {
                type: 'save_result',
                characterName: saveData.casterName,
                rollType: 'save-prismatic-spray-violet',
                targetName,
                saveDc: saveData.dc,
                saveType: 'WIS',
                success: false,
                description: `${targetName} failed WIS save against Prismatic Spray (Violet ray) and is banished to another plane of existence.`,
            }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            await logService.addEntry(campaignName, {
                type: 'condition',
                action: 'removed',
                characterName: targetName,
                condition: 'Blinded',
                reason: 'Prismatic Spray Violet (banishment)',
                note: `${targetName} failed WIS save; Blinded removed, banished to another plane.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            await logService.addEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: 'Incapacitated',
                reason: 'Prismatic Spray Violet (banishment)',
                note: `${targetName} is Incapacitated by banishment.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
            await logService.addEntry(campaignName, {
                type: 'ability_use',
                characterName: saveData.casterName,
                abilityName: 'Prismatic Spray (Violet ray)',
                description: `${targetName} was banished to another plane of existence by the Violet ray of Prismatic Spray.`,
                targetName,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[initiativeSaveResultHandlers:log-error]", e); })
        }

        setCombatSummary(cloneDeep(combatSummary))
    }
}
