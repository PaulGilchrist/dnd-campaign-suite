import React from 'react'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import { setRuntimeValue } from '../../runtime/useRuntimeState.js'
import { isFreeCastAuthorized } from '../../../services/rules/spells/spellPreparationService.js'
import { prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js'
import { triggerHealingWord } from '../../../services/rules/features/healingWordService.js'
import { triggerHoldMonster } from '../../../services/rules/features/holdMonsterService.js'
import { triggerCharmPerson } from '../../../services/rules/features/charmPersonService.js'
import { triggerCharmMonster } from '../../../services/rules/features/charmMonsterService.js'
import { triggerBanishment } from '../../../services/rules/features/banishmentService.js'
import { triggerRevivify } from '../../../services/rules/features/revivifyService.js'
import { applyPolymorph } from '../../../services/automation/handlers/spells/polymorphService.js'
import { applyAnimalShapes } from '../../../services/automation/handlers/spells/animalShapesService.js'
import { applyTruePolymorph } from '../../../services/automation/handlers/spells/truePolymorphService.js'

export function useComplexSpellHandlers(createConfirmHandler, playerStats, campaignName, cfClearPending, getPending, cfSetPending, setPopupHtml, onExecute, _characters) {
  const handleHealingWordConfirm = React.useCallback(async (pending, result) => {
    const targetName = result.targetName
    if (!targetName) return
    const healResult = await triggerHealingWord(
      pending.spell,
      { targetName, slotLevel: pending.spellLevel },
      playerStats,
      campaignName,
      null
    )
    if (healResult && setPopupHtml) {
      const bonusHealDetail = healResult.bonusDetails?.length > 0
        ? healResult.bonusDetails.map(d => `${d.amount} ${d.name}`).join(', ')
        : ''
      const rawTotal = healResult.rawTotal ?? healResult.healAmount
      setPopupHtml({
        type: 'heal',
        name: pending.spellName,
        formula: healResult.formula,
        rolls: healResult.rolls || [],
        total: rawTotal,
        targetName: healResult.targetName,
        finalHeal: healResult.healAmount,
        bonusHeal: healResult.bonusHeal || 0,
        bonusHealDetail,
        healingRerollOriginalRolls: healResult.healingRerollOriginalRolls || null,
        healingRerollDisplayRolls: healResult.healingRerollDisplayRolls || null,
      })
    }
  }, [playerStats, campaignName, setPopupHtml])

  const handleCureWoundsConfirm = React.useCallback(async (pending, result) => {
    const targetName = result.targetName
    if (!targetName) return
    onExecute(pending.spell, { targetName, slotLevel: pending.spellLevel })
  }, [onExecute])

  const handleHoldMonsterConfirm = React.useCallback(async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    await triggerHoldMonster(pending.spell, { holdMonsterTargets: targetNames }, playerStats, campaignName, null)
  }, [playerStats, campaignName])

  const handleHoldPersonConfirm = React.useCallback(async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    await triggerHoldMonster(pending.spell, { holdPersonTargets: targetNames }, playerStats, campaignName, null)
  }, [playerStats, campaignName])

  const handlePolymorphConfirm = React.useCallback(async (pending, result) => {
    const targetName = Array.isArray(result) ? result[0] : result
    if (!targetName) return
    const popup = await applyPolymorph(pending.spell, {
      polymorphTarget: targetName,
      characters: pending.characters || [],
    }, playerStats, campaignName, null)
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, setPopupHtml])

  const handleAnimalShapesTargetConfirm = createConfirmHandler('animalShapes', async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    if (!targetNames.length) return
    setPopupHtml({
      type: 'animal_shapes_target_selection',
      targets: targetNames,
      casterName: playerStats.name,
      campaignName,
      spell: pending.spell,
      spellLevel: pending.spellLevel,
      maxCR: pending.maxCR || 4,
    })
  }, (pending) => pending.creatureTargets)

  const handleAnimalShapesBeastConfirm = React.useCallback(async (targetBeastMap) => {
    const result = await applyAnimalShapes({
      targetBeastMap,
      casterName: playerStats.name,
      spell: getPending('animalShapes')?.spell,
      playerStats,
      campaignName,
    })
    if (result?.ok) {
      const casterCreature = getCombatSummary(campaignName)?.creatures?.find(c => c.name === playerStats.name)
      if (casterCreature) {
        const concentrationDc = 8 + (playerStats.proficiency || 2) + (playerStats.abilities?.CON?.bonus ?? 0)
        setRuntimeValue(playerStats.name, 'animalShapesConcentrationActive', true, campaignName)
        setRuntimeValue(playerStats.name, 'animalShapesConcentrationDc', concentrationDc, campaignName)
      }
    }
    setPopupHtml(null)
  }, [playerStats, campaignName, setPopupHtml, getPending])

  const handleTruePolymorphPathSelect = React.useCallback(async (path) => {
    const pending = getPending('truePolymorph')
    if (!pending) return
    if (path === 'object_into_creature') {
      cfClearPending('truePolymorph')
      const isCantrip = (pending.spell?.level === 0)
      if (!isCantrip && pending.spell) {
        const upcastLevel = pending.spell.upcastLevel
        const isUpcast = upcastLevel != null && upcastLevel !== pending.spell.level
        const gateLevel = isUpcast ? upcastLevel : (pending.spell.level ?? pending.spellLevel ?? 0)
        const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, pending.spellName, gateLevel, playerStats, campaignName)
        await prepareSpellCast(pending.spell, {}, {
          playerName: playerStats.name,
          playerStats,
          campaignName,
          isUpcast,
          upcastLevel,
          freeCastAuthorized,
        })
      }
      const popup = await applyTruePolymorph(pending.spell, {
        truePolymorphTarget: null,
        truePolymorphPath: path,
        characters: pending.characters || [],
      }, playerStats, campaignName, null)
      if (popup?.payload && setPopupHtml) {
        setPopupHtml(popup.payload)
      }
      return
    }
    cfSetPending('truePolymorph', { ...pending, path })
  }, [getPending, cfSetPending, cfClearPending, playerStats, campaignName, setPopupHtml])

  const handleTruePolymorphTargetConfirm = createConfirmHandler('truePolymorph', async (pending, result) => {
    if (!pending?.spell) {
      console.error('[useComplexSpellHandlers] handleTruePolymorphTargetConfirm: no pending spell')
      return
    }
    const targetName = Array.isArray(result) ? result[0] : result
    const path = pending.path || 'creature_to_creature'
    const popup = await applyTruePolymorph(pending.spell, {
      truePolymorphTarget: targetName || null,
      truePolymorphPath: path,
      characters: pending.characters || [],
      slotLevel: pending.spellLevel || pending.spell.level || 9,
    }, playerStats, campaignName, null)
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)

  const handleCharmPersonConfirm = React.useCallback(async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    await triggerCharmPerson(pending.spell, { charmPersonTargets: targetNames }, playerStats, campaignName, null)
  }, [playerStats, campaignName])

  const handleCharmMonsterConfirm = React.useCallback(async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    await triggerCharmMonster(pending.spell, { charmMonsterTargets: targetNames }, playerStats, campaignName, null)
  }, [playerStats, campaignName])

  const handleBanishmentConfirm = React.useCallback(async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    const popup = await triggerBanishment(pending.spell, { banishmentTargets: targetNames }, playerStats, campaignName, null)
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, setPopupHtml])

  const handlePrismaticSprayConfirm = React.useCallback(async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    const finalMetaCtx = { selectedTargets: targetNames }
    onExecute(pending.spell, finalMetaCtx)
  }, [onExecute])

  const handleRevivifyConfirm = React.useCallback(async (pending, result) => {
    const targetName = result.targetName
    if (!targetName) return
    const popup = await triggerRevivify(
      pending.spell,
      { targetName },
      playerStats,
      campaignName,
      targetName
    )
    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, setPopupHtml])

  const handleAnimalFriendshipConfirm = React.useCallback(async (pending, result) => {
    const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, pending.spellName, pending.spellLevel, playerStats, campaignName)
    const preparedResult = await prepareSpellCast(pending.spell, { targetNames: result }, {
      playerName: playerStats.name,
      playerStats,
      campaignName,
      isUpcast: false,
      freeCastAuthorized,
    })
    onExecute(preparedResult.modifiedSpell, preparedResult.metaCtx)
  }, [playerStats, campaignName, onExecute])

  const handleMagicMissileConfirm = React.useCallback((result) => {
    const pending = getPending('magicMissile')
    if (!pending) return

    cfClearPending('magicMissile')

    const { spell } = pending
    const distribution = result.distribution

    const hasAnyTargets = Object.values(distribution).some(v => v > 0)
    if (!hasAnyTargets) return

    const slotLevel = spell.level || 1
    const finalMetaCtx = { magicMissileDistribution: distribution, slotLevel }
    onExecute(spell, finalMetaCtx)
  }, [getPending, onExecute, cfClearPending])

  const handleMagicMissileSkip = React.useCallback(() => {
    cfClearPending('magicMissile')
  }, [cfClearPending])

  const handleTruePolymorphSkip = React.useCallback(() => {
    cfClearPending('truePolymorph')
  }, [cfClearPending])

  return {
    handleHealingWordConfirm,
    handleCureWoundsConfirm,
    handleHoldMonsterConfirm,
    handleHoldPersonConfirm,
    handlePolymorphConfirm,
    handleAnimalShapesTargetConfirm,
    handleAnimalShapesBeastConfirm,
    handleTruePolymorphPathSelect,
    handleTruePolymorphTargetConfirm,
    handleTruePolymorphSkip,
    handleCharmPersonConfirm,
    handleCharmMonsterConfirm,
    handleBanishmentConfirm,
    handlePrismaticSprayConfirm,
    handleRevivifyConfirm,
    handleAnimalFriendshipConfirm,
    handleMagicMissileConfirm,
    handleMagicMissileSkip,
  }
}
