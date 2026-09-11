import { getMaxSorceryPoints, spendSorceryPoints, logMetamagicUse } from '../useMetamagic.js'
import { addEntry } from '../../../services/ui/logService.js'
import { isFreeCastAuthorized } from '../../../services/rules/spells/spellPreparationService.js'
import { prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js'
import { getConsumedMaterial, consumeMaterial } from '../../../services/rules/spells/materialComponents.js'

const METAMAGIC_CONTEXT_FLAGS = {
  'Heightened Spell': 'metamagicHeighten',
  'Careful Spell': 'metamagicCareful',
  'Distant Spell': 'metamagicDistant',
}

function buildMetamagicContext(pending, result, usePsionicPayment) {
  const metaCtx = { ...pending._metaCtx }
  if (result?.options) {
    for (const [option, flagKey] of Object.entries(METAMAGIC_CONTEXT_FLAGS)) {
      if (result.options.includes(option)) metaCtx[flagKey] = true
    }
    if (result.options.includes('Twinned Spell') && result.twinTarget) metaCtx.metamagicTwinTarget = result.twinTarget
  }
  if (usePsionicPayment) {
    metaCtx.psionicSpell = true
  }
  return metaCtx
}

// CLA-312: gate free-cast authorization on the EFFECTIVE cast level.
function resolveGateLevel(spell, spellLevel) {
  return (spell?.isUpcast && spell?.upcastLevel) || (spell?.level ?? spellLevel ?? 0)
}

export function useMetamagicHandler(playerStats, campaignName, cfClearPending, getPending, onExecute) {
  const handleConfirm = async (result) => {
    const pending = getPending('metamagic')
    if (!pending) return

    cfClearPending('metamagic')

    // CLA-271: the popup confirms Metamagic-options cost only; the Psionic Sorcery
    // SP payment is owned by prepareSpellCast (spends SP, skips the spell slot and
    // logs the canonical psionic_sorcery entry). Do not spend psionic SP here.
    const totalMetamagicCost = result?.totalCost || 0
    const usePsionicPayment = !!(result?.psionicActive || pending.spell?.usePsionicPayment)
    const psionicCost = usePsionicPayment ? (pending.psionicCost || 0) : 0
    const totalCost = totalMetamagicCost + psionicCost

    if (totalMetamagicCost > 0) {
      spendSorceryPoints(playerStats.name, totalMetamagicCost, campaignName, getMaxSorceryPoints(playerStats))
    }

    const metamagicOptions = result?.options || []
    if (usePsionicPayment && !metamagicOptions.includes('Psionic Sorcery')) {
      metamagicOptions.push('Psionic Sorcery')
    }

    if (totalCost > 0) {
      logMetamagicUse(campaignName, playerStats.name, pending.spellName, metamagicOptions, totalCost)
    }

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: pending._metaCtx?.multiTarget || null,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: metamagicOptions,
      spCost: totalCost,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useMetamagicHandler:log-error]", e); })

    const metaCtx = buildMetamagicContext(pending, result, usePsionicPayment)

    const isUpcast = pending.spell?.isUpcast
    const upcastLevel = pending.spell?.upcastLevel
    const gateLevel = resolveGateLevel(pending.spell, pending.spellLevel)
    const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, pending.spellName, gateLevel, playerStats, campaignName)
    const result2 = await prepareSpellCast(pending.spell, metaCtx, {
      playerName: playerStats.name,
      playerStats,
      campaignName,
      isUpcast,
      upcastLevel,
      freeCastAuthorized,
      usePsionicPayment,
    })
    if (!metaCtx.slotLevel && upcastLevel) {
      metaCtx.slotLevel = upcastLevel
    }
    const sorcMaterial = getConsumedMaterial(pending.spell)
    if (sorcMaterial) await consumeMaterial(playerStats, sorcMaterial.itemName, campaignName)
    onExecute(result2.modifiedSpell, result2.metaCtx)
  }

  const handleSkip = async () => {
    const pending = getPending('metamagic')
    if (!pending) return

    cfClearPending('metamagic')

    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      metamagic: [],
      spCost: 0,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useMetamagicHandler:log-error]", e); })

    const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, pending.spellName, pending.spellLevel, playerStats, campaignName)
    const result = await prepareSpellCast(pending.spell, {}, {
      playerName: playerStats.name,
      playerStats,
      campaignName,
      isUpcast: false,
      freeCastAuthorized,
    })
    onExecute(result.modifiedSpell, result.metaCtx)
  }

  return { handleConfirm, handleSkip }
}
