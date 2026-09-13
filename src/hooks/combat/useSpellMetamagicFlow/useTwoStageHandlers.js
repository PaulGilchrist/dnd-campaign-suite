import React from 'react'
import { addEntry } from '../../../services/ui/logService.js'
import { rollbackSpellSlot } from '../useConfirmableFlow.js'
import { applyEnhanceAbilityEffect } from '../../../services/automation/index.js'
import { applyProtectionFromEnergyHandler } from '../../../services/automation/index.js'
import { applyResistanceEffect } from '../../../services/automation/index.js'
import { isFreeCastAuthorized, prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js'

export function useTwoStageHandlers({ playerStats, campaignName, cfClearPending, getPending, setPopupHtml }) {
  const [resistanceStage, setResistanceStage] = React.useState(null)
  const [resistanceSelectedTargets, setResistanceSelectedTargets] = React.useState([])
  const [protectionFromEnergyStage, setProtectionFromEnergyStage] = React.useState(null)
  const [protectionFromEnergySelectedTarget, setProtectionFromEnergySelectedTarget] = React.useState(null)
  const [enhanceAbilityStage, setEnhanceAbilityStage] = React.useState(null)
  const [enhanceAbilitySelectedAbility, setEnhanceAbilitySelectedAbility] = React.useState(null)

  React.useEffect(() => {
    if (getPending('resistance') && resistanceStage === null) {
      setResistanceStage('target')
    }
  }, [getPending, resistanceStage])

  React.useEffect(() => {
    if (getPending('protectionFromEnergy') && protectionFromEnergyStage === null) {
      setProtectionFromEnergyStage('target')
    }
  }, [getPending, protectionFromEnergyStage])

  React.useEffect(() => {
    if (getPending('enhanceAbility') && enhanceAbilityStage === null) {
      setEnhanceAbilityStage('ability')
    }
  }, [getPending, enhanceAbilityStage])

  const handleResistanceTargetSelect = React.useCallback(async (targetName) => {
    setResistanceSelectedTargets([targetName])
    setResistanceStage('type')
  }, [])

  const handleResistanceTypeSelect = React.useCallback(async (damageType) => {
    const pending = getPending('resistance')
    if (!pending) return

    const targets = resistanceSelectedTargets.length > 0 ? resistanceSelectedTargets : [resistanceSelectedTargets]
    cfClearPending('resistance')
    setResistanceStage(null)
    setResistanceSelectedTargets([])

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: targets[0] || null,
      targets,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useTwoStageHandlers:log-error]", e); })

    for (const target of targets) {
      await applyResistanceEffect(
        { name: pending.spellName, spell: pending.spell, automation: { type: 'damage_reduction', reductionExpression: '1d4', damageTypes: [], trigger: 'damage_taken_of_chosen_resistance_type' } },
        playerStats,
        campaignName,
        target,
        damageType
      )
    }
  }, [playerStats, campaignName, cfClearPending, getPending, resistanceSelectedTargets])

  const handleResistanceSkip = React.useCallback(() => {
    const pending = getPending('resistance')
    if (!pending) return
    cfClearPending('resistance')
    setResistanceStage(null)
    setResistanceSelectedTargets([])

    rollbackSpellSlot(playerStats.name, pending.spellName, pending.spellLevel || 0, playerStats, campaignName)

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: null,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useTwoStageHandlers:log-error]", e); })
  }, [playerStats, campaignName, cfClearPending, getPending])

  const handleProtectionFromEnergyTargetSelect = React.useCallback(async (targetName) => {
    setProtectionFromEnergySelectedTarget(targetName)
    setProtectionFromEnergyStage('type')
  }, [])

  const handleProtectionFromEnergyTypeSelect = React.useCallback(async (damageType) => {
    const pending = getPending('protectionFromEnergy')
    if (!pending || !protectionFromEnergySelectedTarget) return

    const targetName = protectionFromEnergySelectedTarget
    cfClearPending('protectionFromEnergy')
    setProtectionFromEnergyStage(null)
    setProtectionFromEnergySelectedTarget(null)

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName,
      targets: [targetName],
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useTwoStageHandlers:log-error]", e); })

    // SP-093: consume the spell slot via prepareSpellCast at type-select confirm,
    // mirroring createConfirmHandler (useConfirmableFlow.js) / SP-085 — the two-stage
    // confirm previously bypassed it, so no slot was ever spent.
    const isCantrip = (pending.spell?.level === 0)
    if (!isCantrip && pending.spell) {
      const upcastLevel = pending.spell.upcastLevel
      const isUpcast = upcastLevel != null && upcastLevel !== pending.spell.level
      // CLA-312: gate free-cast authorization on the EFFECTIVE cast level.
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

    await applyProtectionFromEnergyHandler(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'protection_from_energy', damageTypes: pending.damageTypes } },
      playerStats,
      campaignName,
      targetName,
      damageType
    )
  }, [playerStats, campaignName, cfClearPending, getPending, protectionFromEnergySelectedTarget])

  const handleProtectionFromEnergySkip = React.useCallback(() => {
    const pending = getPending('protectionFromEnergy')
    if (pending) {
      const targets = pending.creatureTargets
      addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        targetName: targets?.[0] || null,
        targets,
        spellName: pending.spellName,
        spellLevel: pending.spellLevel || 0,
        castingTime: pending.castingTime,
        timestamp: Date.now(),
      }).catch((e) => { console.error("[useTwoStageHandlers:log-error]", e); })
      // SP-093: no rollback — the slot is only spent at type-select confirm, so a
      // skip here has consumed nothing and rolling back would inflate slots above max.
    }
    cfClearPending('protectionFromEnergy')
    setProtectionFromEnergyStage(null)
    setProtectionFromEnergySelectedTarget(null)
  }, [playerStats, campaignName, cfClearPending, getPending])

  const handleEnhanceAbilityAbilitySelect = React.useCallback((ability) => {
    setEnhanceAbilitySelectedAbility(ability)
    setEnhanceAbilityStage('target')
  }, [])

  const handleEnhanceAbilityConfirm = React.useCallback(async (result) => {
    const pending = getPending('enhanceAbility')
    if (!pending) return

    const ability = enhanceAbilitySelectedAbility
    if (!ability) return

    const targets = Array.isArray(result) ? result : [result?.targetName || result]
    cfClearPending('enhanceAbility')
    setEnhanceAbilityStage(null)
    setEnhanceAbilitySelectedAbility(null)

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: targets[0] || null,
      targets,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useTwoStageHandlers:log-error]", e); })

    const popup = await applyEnhanceAbilityEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'enhance_ability', range: pending.range } },
      playerStats,
      campaignName,
      null,
      targets,
      ability
    )

    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, cfClearPending, getPending, enhanceAbilitySelectedAbility, setPopupHtml])

  const handleEnhanceAbilitySkip = React.useCallback(() => {
    const pending = getPending('enhanceAbility')
    if (!pending) return
    cfClearPending('enhanceAbility')
    setEnhanceAbilityStage(null)
    setEnhanceAbilitySelectedAbility(null)
    rollbackSpellSlot(playerStats.name, pending.spellName, pending.spellLevel || 0, playerStats, campaignName)
  }, [cfClearPending, getPending, playerStats, campaignName])

  return {
    resistanceStage, setResistanceStage,
    resistanceSelectedTargets, setResistanceSelectedTargets,
    protectionFromEnergyStage, setProtectionFromEnergyStage,
    protectionFromEnergySelectedTarget, setProtectionFromEnergySelectedTarget,
    enhanceAbilityStage, setEnhanceAbilityStage,
    enhanceAbilitySelectedAbility, setEnhanceAbilitySelectedAbility,
    handleResistanceTargetSelect, handleResistanceTypeSelect, handleResistanceSkip,
    handleProtectionFromEnergyTargetSelect, handleProtectionFromEnergyTypeSelect, handleProtectionFromEnergySkip,
    handleEnhanceAbilityAbilitySelect, handleEnhanceAbilityConfirm, handleEnhanceAbilitySkip,
  }
}
