import React from 'react'
import { addEntry } from '../../../services/ui/logService.js'
import { rollbackSpellSlot } from '../useConfirmableFlow.js'
import { applyBarkskinEffect } from '../../../services/automation/index.js'
import { applyPassWithoutTraceEffect } from '../../../services/automation/index.js'
import { applyProtectionFromPoisonHandler } from '../../../services/automation/index.js'
import { applyStoneSkinHandler } from '../../../services/automation/index.js'
import { consumeMaterial } from '../../../services/rules/spells/materialComponents.js'
import { isFreeCastAuthorized, prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js'
import { triggerPrimalCompanionSpellShare } from '../../../services/rules/features/primalCompanionSpellShareService.js'

async function consumeProtectionFromPoisonSlot(pending, playerStats, campaignName) {
  const isCantrip = (pending.spell?.level === 0)
  if (isCantrip || !pending.spell) return
  const upcastLevel = pending.spell.upcastLevel
  const isUpcast = upcastLevel != null && upcastLevel !== pending.spell.level
  // CLA-312: gate free-cast authorization on the EFFECTIVE cast level.
  const gateLevel = isUpcast ? upcastLevel : (pending.spell.level ?? pending.spellLevel ?? 0)
  const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, pending.spellName, gateLevel, playerStats, campaignName)
  const slotResult = await prepareSpellCast(pending.spell, {}, {
    playerName: playerStats.name,
    playerStats,
    campaignName,
    isUpcast,
    upcastLevel,
    freeCastAuthorized,
  })
  if (slotResult && slotResult.slotConsumed) {
    addEntry(campaignName, {
      type: 'ability_use',
      characterName: playerStats.name,
      abilityName: pending.spellName,
      spellName: pending.spellName,
      description: `${pending.spellName}: Expended a level ${(slotResult.modifiedSpell && slotResult.modifiedSpell.level) || pending.spellLevel || 0} spell slot.`,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useCustomHandlers:log-error]", e); })
  }
}

export function useCustomHandlers(playerStats, campaignName, cfClearPending, getPending, setPopupHtml, characters) {
  const handleBarkskinConfirm = React.useCallback(async (result) => {
    const pending = getPending('barkskin')
    if (!pending) return

    cfClearPending('barkskin')

    const targets = pending.creatureTargets
    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: result?.[0] || null,
      targets: targets,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useCustomHandlers:log-error]", e); })

    const popup = await applyBarkskinEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'barkskin', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result,
      characters
    )

    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, cfClearPending, getPending, setPopupHtml, characters])

  const handleBarkskinSkip = React.useCallback(() => {
    const pending = getPending('barkskin')
    if (!pending) return
    cfClearPending('barkskin')
  }, [cfClearPending, getPending])

  const handlePassWithoutTraceConfirm = React.useCallback(async (result) => {
    const pending = getPending('passWithoutTrace')
    if (!pending) return

    cfClearPending('passWithoutTrace')

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: result?.[0] || null,
      targets: result || [],
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useCustomHandlers:log-error]", e); })

    // SP-085: consume the spell slot + register concentration via prepareSpellCast,
    // mirroring createConfirmHandler (useConfirmableFlow.js) — the custom confirm
    // previously bypassed it, so no slot was spent and no concentration tracked.
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

    const popup = await applyPassWithoutTraceEffect(
      pending.spell,
      playerStats,
      campaignName,
      null,
      result
    )

    // CLA-311: Share Spells — self-range spell confirmed on targets; mirror the
    // spell's targetEffects onto the active Primal Companion (within 30 ft).
    triggerPrimalCompanionSpellShare(
      pending.spell,
      { slotLevel: pending.spellLevel || 0 },
      playerStats,
      campaignName,
      null
    ).catch((e) => { console.error('[useCustomHandlers] Share Spells trigger failed:', e) })

    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, cfClearPending, getPending, setPopupHtml])

  const handlePassWithoutTraceSkip = React.useCallback(() => {
    const pending = getPending('passWithoutTrace')
    if (!pending) return
    cfClearPending('passWithoutTrace')
  }, [cfClearPending, getPending])

  const handleProtectionFromPoisonConfirm = React.useCallback(async (result) => {
    const pending = getPending('protectionFromPoison')
    if (!pending) return

    cfClearPending('protectionFromPoison')

    const targetName = result?.[0]
    if (!targetName) return

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: targetName,
      targets: [targetName],
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useCustomHandlers:log-error]", e); })

    // SP-095: consume the spell slot via prepareSpellCast, mirroring SP-085 /
    // createConfirmHandler (useConfirmableFlow.js) — the custom confirm previously
    // bypassed it, so no lv2 slot was ever spent. No concentration is registered
    // because the spell data says concentration:false (RAW 2024: not concentration).
    await consumeProtectionFromPoisonSlot(pending, playerStats, campaignName)

    const popup = await applyProtectionFromPoisonHandler(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'protection_from_poison', range: pending.range } },
      playerStats,
      campaignName,
      null,
      { targetName }
    )

    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, cfClearPending, getPending, setPopupHtml])

  const handleProtectionFromPoisonSkip = React.useCallback(() => {
    const pending = getPending('protectionFromPoison')
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
      }).catch((e) => { console.error("[useCustomHandlers:log-error]", e); })
      // SP-095: no rollbackSpellSlot — the gate never spends the slot; it is spent
      // at confirm time in handleProtectionFromPoisonConfirm (mirrors SP-085/SP-093).
    }
    cfClearPending('protectionFromPoison')
  }, [playerStats, campaignName, cfClearPending, getPending])

  const handleStoneSkinConfirm = React.useCallback(async (targetName) => {
    const pending = getPending('stoneSkin')
    if (!pending) return

    cfClearPending('stoneSkin')
    await consumeMaterial(playerStats, 'Diamond Dust (100 gp)', campaignName)

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: targetName,
      targets: [targetName],
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useCustomHandlers:log-error]", e); })

    const popup = await applyStoneSkinHandler(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'protection_from_energy', damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'], duration: 'Concentration, up to 1 hour', target: 'willing_creature' } },
      playerStats,
      campaignName,
      targetName
    )

    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, [playerStats, campaignName, cfClearPending, getPending, setPopupHtml])

  const handleStoneSkinSkip = React.useCallback(() => {
    const pending = getPending('stoneSkin')
    if (pending) {
      const targetName = pending.creatureTargets?.[0] || null
      addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        targetName: targetName,
        targets: pending.creatureTargets,
        spellName: pending.spellName,
        spellLevel: pending.spellLevel || 0,
        castingTime: pending.castingTime,
        timestamp: Date.now(),
      }).catch((e) => { console.error("[useCustomHandlers:log-error]", e); })
      rollbackSpellSlot(playerStats.name, pending.spellName, pending.spellLevel || 0, playerStats, campaignName)
    }
    cfClearPending('stoneSkin')
  }, [playerStats, campaignName, cfClearPending, getPending])

  return {
    handleBarkskinConfirm, handleBarkskinSkip,
    handlePassWithoutTraceConfirm, handlePassWithoutTraceSkip,
    handleProtectionFromPoisonConfirm, handleProtectionFromPoisonSkip,
    handleStoneSkinConfirm, handleStoneSkinSkip,
  }
}
