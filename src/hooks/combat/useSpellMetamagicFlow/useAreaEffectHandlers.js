import React from 'react'
import { addEntry } from '../../../services/ui/logService.js'
import { executeHandler } from '../../../services/automation/index.js'
import { consumeMaterial } from '../../../services/rules/spells/materialComponents.js'

export function useAreaEffectHandlers(createSkipHandler, playerStats, campaignName, cfClearPending, getPending, setPopupHtml) {
  const handleGlobeConfirm = React.useCallback(async (result) => {
    const pending = getPending('globe')
    if (!pending) return

    cfClearPending('globe')

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: result?.[0] || null,
      targets: result || [],
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useAreaEffectHandlers:log-error]", e); })

    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: { type: 'globe_of_invulnerability', range: pending.range },
      metaCtx: { creatures: result },
    }
    const popup = await executeHandler(action, playerStats, campaignName, null)

    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, cfClearPending, getPending, setPopupHtml])

  const handleForcecageConfirm = React.useCallback(async (result) => {
    const pending = getPending('forcecage')
    if (!pending) return

    cfClearPending('forcecage')
    await consumeMaterial(playerStats, 'Ruby Dust (1,500 gp)', campaignName)

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: result?.[0] || null,
      targets: result || [],
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useAreaEffectHandlers:log-error]", e); })

    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: {
        type: 'forcecage',
        saveDc: 'ability',
        saveAbility: 'CHA',
        duration: 'Concentration, up to 1 hour',
        concentration: true,
        ruleset: '2024',
        range: pending.range,
      },
      metaCtx: { creatures: result },
    }
    const popup = await executeHandler(action, playerStats, campaignName, null)

    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, cfClearPending, getPending, setPopupHtml])

  const handleAntimagicFieldConfirm = React.useCallback(async (result) => {
    const pending = getPending('antimagicField')
    if (!pending) return

    cfClearPending('antimagicField')

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: result?.[0] || null,
      targets: result || [],
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useAreaEffectHandlers:log-error]", e); })

    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: { type: 'antimagic_field', range: pending.range },
      metaCtx: { creatures: result },
    }
    const popup = await executeHandler(action, playerStats, campaignName, null)

    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, cfClearPending, getPending, setPopupHtml])

  const handleStinkingCloudConfirm = React.useCallback(async (pending, result) => {
    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: { type: 'stinking_cloud', saveDc: pending.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2), saveType: 'CON' },
      metaCtx: { targets: result },
    }
    await executeHandler(action, playerStats, campaignName, null)
  }, [playerStats, campaignName])

  const handleConfusionConfirm = React.useCallback(async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: { type: 'confusion', saveDc: pending.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2), saveType: 'WIS' },
      metaCtx: { targets: targetNames, metamagicHeighten: pending.metamagicHeighten },
    }
    const popup = await executeHandler(action, playerStats, campaignName, null)
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, setPopupHtml])

  const handleSleetStormConfirm = React.useCallback(async (pending, result) => {
    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: { type: 'sleet_storm', saveDc: pending.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2), saveType: 'DEX' },
      metaCtx: { targets: result },
    }
    await executeHandler(action, playerStats, campaignName, null)
  }, [playerStats, campaignName])

  const handleGlobeSkip = createSkipHandler('globe', (pending) => pending.creatureTargets)
  const handleForcecageSkip = createSkipHandler('forcecage', (pending) => pending.creatureTargets)
  const handleAntimagicFieldSkip = createSkipHandler('antimagicField', (pending) => pending.creatureTargets)

  return {
    handleGlobeConfirm, handleGlobeSkip,
    handleForcecageConfirm, handleForcecageSkip,
    handleAntimagicFieldConfirm, handleAntimagicFieldSkip,
    handleStinkingCloudConfirm,
    handleConfusionConfirm,
    handleSleetStormConfirm,
  }
}
