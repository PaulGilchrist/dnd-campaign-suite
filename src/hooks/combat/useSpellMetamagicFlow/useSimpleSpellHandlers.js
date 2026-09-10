import {
  applyAidEffect, applyHeroesFeastEffect, applyLesserRestorationEffect,
  applyMageArmorEffect,
  applyProtectionFromEvilAndGood,
  applyShieldOfFaithEffect,
  applyBaneEffect, applyBlessEffect, applyBeaconOfHopeEffect,
  applyHolyAuraEffect, applyHaste, applyInvisibility,
  applyGreaterInvisibility,
  applyAuraOfLifeEffect, applyAuraOfPurityEffect,
  applyCircleOfPowerEffect, applyCompulsionEffect,
  applyAuraOfVitalityEffect, applyDeathWardEffect,
  applyFeignDeath, applyHeroism,
  applyLongstriderEffect, applySpareTheDyingEffect,
  handleSanctuary, executeHandler,
} from '../../../services/automation/index.js'
import { triggerFaerieFire } from '../../../services/rules/features/faerieFireService.js'
import { triggerHeal } from '../../../services/rules/features/healService.js'
import { triggerForesight } from '../../../services/rules/features/foresightService.js'
import { triggerHoldMonster } from '../../../services/rules/features/holdMonsterService.js'
import { triggerCharmPerson } from '../../../services/rules/features/charmPersonService.js'
import { triggerCharmMonster } from '../../../services/rules/features/charmMonsterService.js'
import { triggerBanishment } from '../../../services/rules/features/banishmentService.js'
import { triggerRevivify } from '../../../services/rules/features/revivifyService.js'
import { triggerHealingWord } from '../../../services/rules/features/healingWordService.js'
import { applyPolymorph } from '../../../services/automation/handlers/spells/polymorphService.js'
import { confirmGreaterRestoration } from '../../../services/rules/features/greaterRestorationService.js'
import { confirmRemoveCurse } from '../../../services/rules/features/removeCurseService.js'
import { confirmRegenerate } from '../../../services/rules/features/regenerateService.js'
import { consumeMaterial } from '../../../services/rules/spells/materialComponents.js'
import { addEntry } from '../../../services/ui/logService.js'
import { rollbackSpellSlot } from '../useConfirmableFlow.js'
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js'
import { isFreeCastAuthorized } from '../../../services/rules/spells/spellPreparationService.js'
import { prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js'

export function useSimpleSpellHandlers(createConfirmHandler, createSkipHandler, playerStats, campaignName, characters, setPopupHtml, getPending, cfClearPending, onExecute) {
  const handleAidConfirm = createConfirmHandler('aid', async (pending, result) => {
    await applyAidEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'aid', range: pending.range, maxTargets: pending.maxTargets } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleAidSkip = createSkipHandler('aid', (pending) => pending.creatureTargets)

  const handleBaneConfirm = createConfirmHandler('bane', async (pending, result) => {
    await applyBaneEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'bane', range: pending.range, maxTargets: pending.maxTargets } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleBaneSkip = createSkipHandler('bane', (pending) => pending.creatureTargets)

  const handleBlessConfirm = createConfirmHandler('bless', async (pending, result) => {
    await applyBlessEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'bless', range: pending.range, maxTargets: pending.maxTargets } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleBlessSkip = createSkipHandler('bless', (pending) => pending.creatureTargets)

  const handleFaerieFireConfirm = createConfirmHandler('faerieFire', async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    const popup = await triggerFaerieFire(pending.spell, { targets: targetNames }, playerStats, campaignName, null)
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleFaerieFireSkip = createSkipHandler('faerieFire', (pending) => pending.creatureTargets)

  const handleHolyAuraConfirm = createConfirmHandler('holyAura', async (pending, result) => {
    const popup = await applyHolyAuraEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'holy_aura', duration: pending.spell.duration, auraRange: 30, casting_time: pending.castingTime } },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleHolyAuraSkip = createSkipHandler('holyAura', (pending) => pending.creatureTargets)

  const handleSlowConfirm = createConfirmHandler('slow', async (pending, result) => {
    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: { type: 'slow', range: pending.range, saveDc: pending.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2), saveType: 'WIS' },
      metaCtx: { targets: result },
    }
    await executeHandler(action, playerStats, campaignName, null, null)
  }, (pending) => pending.creatureTargets)
  const handleSlowSkip = createSkipHandler('slow', (pending) => pending.creatureTargets)

  const handleHasteSkip = createSkipHandler('haste', (pending) => pending.creatureTargets)
  const handleHasteConfirm = createConfirmHandler('haste', async (pending, result) => {
    await applyHaste(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'haste' } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)

  const handleInvisibilityConfirm = createConfirmHandler('invisibility', async (pending, result) => {
    await applyInvisibility(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'invisibility' } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleInvisibilitySkip = createSkipHandler('invisibility', (pending) => pending.creatureTargets)

  const handleGreaterInvisibilityConfirm = createConfirmHandler('greaterInvisibility', async (pending, result) => {
    await applyGreaterInvisibility(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'greater_invisibility' } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleGreaterInvisibilitySkip = createSkipHandler('greaterInvisibility', (pending) => pending.creatureTargets)

  const handleFeignDeathConfirm = createConfirmHandler('feignDeath', async (pending, result) => {
    const popup = await applyFeignDeath(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'feign_death' } },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleFeignDeathSkip = createSkipHandler('feignDeath', (pending) => pending.creatureTargets)

  const handleHealConfirm = createConfirmHandler('heal', async (pending, result) => {
    const targetName = result.targetName
    if (!targetName) return
    await triggerHeal(
      { name: pending.spellName, spell: pending.spell, level: pending.spellLevel },
      { targetName },
      playerStats,
      campaignName,
      null
    )
  }, (pending) => pending.creatureTargets)
  const handleHealSkip = createSkipHandler('heal', (pending) => pending.creatureTargets)

  const handleLongstriderConfirm = createConfirmHandler('longstrider', async (pending, result) => {
    const popup = await applyLongstriderEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'longstrider' } },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleLongstriderSkip = createSkipHandler('longstrider', (pending) => pending.creatureTargets)

  const handleSpareTheDyingConfirm = createConfirmHandler('spareTheDying', async (pending, result) => {
    const popup = await applySpareTheDyingEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'spare_the_dying' } },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleSpareTheDyingSkip = createSkipHandler('spareTheDying', (pending) => pending.creatureTargets)

  const handleBeaconOfHopeConfirm = createConfirmHandler('beaconOfHope', async (pending, result) => {
    const popup = await applyBeaconOfHopeEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'beacon_of_hope', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleBeaconOfHopeSkip = createSkipHandler('beaconOfHope', (pending) => pending.creatureTargets)

  const handleHeroesFeastConfirm = createConfirmHandler('heroesFeast', async (pending, result) => {
    await consumeMaterial(playerStats, 'Gem-Encrusted Bowl (1,000 gp)', campaignName)
    await applyHeroesFeastEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'heroes_feast', range: pending.range, maxTargets: pending.maxTargets } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleHeroesFeastSkip = createSkipHandler('heroesFeast', (pending) => pending.creatureTargets)

  const handleAuraOfLifeConfirm = createConfirmHandler('auraOfLife', async (pending, result) => {
    await applyAuraOfLifeEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'aura_of_life' } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleAuraOfLifeSkip = createSkipHandler('auraOfLife', (pending) => pending.creatureTargets)

  const handleAuraOfPurityConfirm = createConfirmHandler('auraOfPurity', async (pending, result) => {
    await applyAuraOfPurityEffect(
      { name: pending.spellName, spell: pending.spell, automation: pending.spell.automation || { type: 'aura_of_purity' } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleAuraOfPuritySkip = createSkipHandler('auraOfPurity', (pending) => pending.creatureTargets)

  const handleCircleOfPowerConfirm = createConfirmHandler('circleOfPower', async (pending, result) => {
    const popup = await applyCircleOfPowerEffect(
      { name: pending.spellName, spell: pending.spell, automation: pending.spell.automation || { type: 'circle_of_power', auraRange: 30 } },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleCircleOfPowerSkip = createSkipHandler('circleOfPower', (pending) => pending.creatureTargets)

  const handleCompulsionConfirm = createConfirmHandler('compulsion', async (pending, result) => {
    const popup = await applyCompulsionEffect(
      { name: pending.spellName, spell: pending.spell, automation: pending.spell.automation || { type: 'compulsion' } },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleCompulsionSkip = createSkipHandler('compulsion', (pending) => pending.creatureTargets)

  const handleAuraOfVitalityConfirm = createConfirmHandler('auraOfVitality', async (pending, result) => {
    const popup = await applyAuraOfVitalityEffect(
      { name: pending.spellName, spell: pending.spell, automation: pending.spell.automation || { type: 'aura_of_vitality' }, spellSlotLevel: pending.spellLevel },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleAuraOfVitalitySkip = createSkipHandler('auraOfVitality', (pending) => pending.creatureTargets)

  const handleDeathWardConfirm = createConfirmHandler('deathWard', async (pending, result) => {
    const popup = await applyDeathWardEffect(
      { name: pending.spellName, spell: pending.spell, automation: pending.spell.automation || { type: 'death_ward' }, spellSlotLevel: pending.spellLevel },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleDeathWardSkip = createSkipHandler('deathWard', (pending) => pending.creatureTargets)

  const handleHeroismConfirm = createConfirmHandler('heroism', async (pending, result) => {
    const popup = await applyHeroism(
      { name: pending.spellName, spell: pending.spell, automation: pending.spell.automation || { type: 'heroism' } },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleHeroismSkip = createSkipHandler('heroism', (pending) => pending.creatureTargets)

  const handleGreaterRestorationConfirm = createConfirmHandler('greaterRestoration', async (pending, result) => {
    await consumeMaterial(playerStats, 'Diamond Dust (100 gp)', campaignName)
    await confirmGreaterRestoration(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'greater_restoration', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleGreaterRestorationSkip = createSkipHandler('greaterRestoration', (pending) => pending.creatureTargets)

  const handleGreaterRestorationNoEffects = () => {
    const pending = getPending('greaterRestoration')
    if (!pending) return
    cfClearPending('greaterRestoration')
    const slotKey = `spell_slots_level_${pending.spellLevel || 0}`
    const current = getRuntimeValue(playerStats.name, slotKey, campaignName)
    const max = (playerStats.spellAbilities && playerStats.spellAbilities[slotKey]) || 0
    const available = current != null ? current : max
    if (available >= 0) {
      setRuntimeValue(playerStats.name, slotKey, available + 1, campaignName)
    }
    addEntry(campaignName, {
      type: 'spell',
      characterName: playerStats.name,
      targetName: null,
      targets: [],
      spellName: pending.spellName,
      spellLevel: pending.spellLevel || 0,
      castingTime: pending.castingTime,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[useSimpleSpellHandlers:log-error]", e); })
  }

  const handleLesserRestorationConfirm = createConfirmHandler('lesserRestoration', async (pending, result) => {
    await applyLesserRestorationEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'lesser_restoration', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleLesserRestorationSkip = createSkipHandler('lesserRestoration', (pending) => pending.creatureTargets)

  const handleRemoveCurseConfirm = createConfirmHandler('removeCurse', async (pending, result) => {
    const popup = await confirmRemoveCurse(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'remove_curse', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    )
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleRemoveCurseSkip = createSkipHandler('removeCurse', (pending) => pending.creatureTargets)

  const handleMageArmorConfirm = createConfirmHandler('mageArmor', async (pending, result) => {
    await applyMageArmorEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'mage_armor', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleMageArmorSkip = createSkipHandler('mageArmor', (pending) => pending.creatureTargets)

  const handleForesightConfirm = createConfirmHandler('foresight', async (pending, result) => {
    const targetName = result?.[0] || pending.creatureTargets?.[0]
    if (!targetName) return
    const popup = await triggerForesight(
      { name: pending.spellName, spell: pending.spell },
      { targetName },
      playerStats,
      campaignName,
      null
    )
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleForesightSkip = createSkipHandler('foresight', (pending) => pending.creatureTargets)

  const handleProtectionFromEvilAndGoodConfirm = createConfirmHandler('protectionFromEvilAndGood', async (pending, result) => {
    await consumeMaterial(playerStats, 'Flask of Holy Water (25 gp)', campaignName)
    await applyProtectionFromEvilAndGood(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'protection_from_evil_and_good' } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => [pending.creatureTargets.find(n => n === playerStats.name) || pending.creatureTargets[0]])
  const handleProtectionFromEvilAndGoodSkip = createSkipHandler('protectionFromEvilAndGood', (pending) => [pending.creatureTargets[0]])

  const handleShieldOfFaithConfirm = createConfirmHandler('shieldOfFaith', async (pending, result) => {
    await applyShieldOfFaithEffect(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'shield_of_faith', range: pending.range } },
      playerStats,
      campaignName,
      null,
      result
    )
  }, (pending) => pending.creatureTargets)
  const handleShieldOfFaithSkip = createSkipHandler('shieldOfFaith', (pending) => pending.creatureTargets)

  const handleRegenerateConfirm = createConfirmHandler('regenerate', async (pending, result) => {
    const targetName = result?.targetName
    if (!targetName) return
    const popup = await confirmRegenerate(
      { name: pending.spellName, spell: pending.spell, automation: { type: 'regenerate', range: pending.range } },
      playerStats,
      campaignName,
      null,
      targetName
    )
    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleRegenerateSkip = createSkipHandler('regenerate', (pending) => pending.creatureTargets)

  const handleSanctuaryConfirm = createConfirmHandler('sanctuary', async (pending, result) => {
    const targetName = result
    if (!targetName) return
    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: { type: 'sanctuary', range: pending.range, duration: '1 minute', casting_time: pending.castingTime },
      metaCtx: { targetName },
    }
    const popup = await handleSanctuary(action, playerStats, campaignName, null)
    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleSanctuarySkip = createSkipHandler('sanctuary', (pending) => pending.creatureTargets)

  const handleSleetStormConfirm = createConfirmHandler('sleetStorm', async (pending, result) => {
    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: { type: 'sleet_storm', saveDc: pending.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2), saveType: 'DEX' },
      metaCtx: { targets: result },
    }
    await executeHandler(action, playerStats, campaignName, null)
  }, (pending) => pending.creatureTargets)
  const handleSleetStormSkip = createSkipHandler('sleetStorm', (pending) => pending.creatureTargets)

  const handleCureWoundsConfirm = createConfirmHandler('cureWounds', async (pending, result) => {
    const targetName = result.targetName
    if (!targetName) return
    onExecute(pending.spell, { targetName, slotLevel: pending.spellLevel })
  }, (pending) => pending.creatureTargets)
  const handleCureWoundsSkip = createSkipHandler('cureWounds', (pending) => pending.creatureTargets)

  const handleHoldMonsterConfirm = createConfirmHandler('holdMonster', async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    await triggerHoldMonster(pending.spell, { holdMonsterTargets: targetNames }, playerStats, campaignName, null)
  }, (pending) => pending.creatureTargets)
  const handleHoldMonsterSkip = createSkipHandler('holdMonster', (pending) => pending.creatureTargets)

  const handleHoldPersonConfirm = createConfirmHandler('holdPerson', async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    await triggerHoldMonster(pending.spell, { holdPersonTargets: targetNames }, playerStats, campaignName, null)
  }, (pending) => pending.creatureTargets)
  const handleHoldPersonSkip = createSkipHandler('holdPerson', (pending) => pending.creatureTargets)

  const handlePolymorphConfirm = createConfirmHandler('polymorph', async (pending, result) => {
    const targetName = Array.isArray(result) ? result[0] : result
    if (!targetName) return
    const popup = await applyPolymorph(pending.spell, {
      polymorphTarget: targetName,
      characters: pending.characters || [],
    }, playerStats, campaignName, null)
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handlePolymorphSkip = createSkipHandler('polymorph', (pending) => pending.creatureTargets)

  const handleAnimalFriendshipConfirm = createConfirmHandler('animalFriendship', async (pending, result) => {
    const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, pending.spellName, pending.spellLevel, playerStats, campaignName)
    const preparedResult = await prepareSpellCast(pending.spell, { targetNames: result }, {
      playerName: playerStats.name,
      playerStats,
      campaignName,
      isUpcast: false,
      freeCastAuthorized,
    })
    onExecute(preparedResult.modifiedSpell, preparedResult.metaCtx)
  }, (pending) => pending.creatureTargets)
  const handleAnimalFriendshipSkip = createSkipHandler('animalFriendship', (pending) => pending.creatureTargets)

  const handleCharmPersonConfirm = createConfirmHandler('charmPerson', async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    await triggerCharmPerson(pending.spell, { charmPersonTargets: targetNames }, playerStats, campaignName, null)
  }, (pending) => pending.creatureTargets)
  const handleCharmPersonSkip = createSkipHandler('charmPerson', (pending) => pending.creatureTargets)

  const handleCharmMonsterConfirm = createConfirmHandler('charmMonster', async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    await triggerCharmMonster(pending.spell, { charmMonsterTargets: targetNames }, playerStats, campaignName, null)
  }, (pending) => pending.creatureTargets)
  const handleCharmMonsterSkip = createSkipHandler('charmMonster', (pending) => pending.creatureTargets)

  const handleBanishmentConfirm = createConfirmHandler('banishment', async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    const popup = await triggerBanishment(pending.spell, { banishmentTargets: targetNames }, playerStats, campaignName, null)
    if (popup?.payload && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending) => pending.creatureTargets)
  const handleBanishmentSkip = createSkipHandler('banishment', (pending) => pending.creatureTargets)

  const handlePrismaticSprayConfirm = createConfirmHandler('prismatic_spray', async (pending, result) => {
    const targetNames = Array.isArray(result) ? result : [result]
    const finalMetaCtx = { selectedTargets: targetNames }
    onExecute(pending.spell, finalMetaCtx)
  }, (pending) => pending.creatureTargets)
  const handlePrismaticSpraySkip = createSkipHandler('prismatic_spray', (pending) => pending.creatureTargets)

  const handleHexConfirm = createConfirmHandler('hex', async (pending, result) => {
    const targetName = Array.isArray(result) ? result[0] : result
    if (!targetName) return
    onExecute(pending.spell, { targetName })
  }, (pending) => pending.creatureTargets)
  const handleHexSkip = createSkipHandler('hex', (pending) => pending.creatureTargets)

  const handleRevivifyConfirm = createConfirmHandler('revivify', async (pending, result) => {
    const targetName = result.targetName
    if (!targetName) return
    const popup = await triggerRevivify(
      pending.spell,
      { targetName },
      playerStats,
      campaignName,
      targetName
    )
    // SP-100: createConfirmHandler spends the slot before applyFn — refund it
    // when the trigger refuses (target no longer dead / material gone).
    if (popup?.payload?.type === 'automation_info') {
      rollbackSpellSlot(playerStats.name, pending.spellName, pending.spellLevel || 0, playerStats, campaignName)
    }
    if (popup && setPopupHtml) {
      setPopupHtml(popup.payload)
    }
  }, (pending, sel) => (sel?.targetName ? [sel.targetName] : pending.creatureTargets))
  const handleRevivifySkip = createSkipHandler('revivify', (pending) => pending.creatureTargets)

  const handleStinkingCloudConfirm = createConfirmHandler('stinkingCloud', async (pending, result) => {
    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: { type: 'stinking_cloud', saveDc: pending.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2), saveType: 'CON' },
      metaCtx: { targets: result },
    }
    await executeHandler(action, playerStats, campaignName, null)
  }, (pending) => pending.creatureTargets)

  const handleStinkingCloudSkip = createSkipHandler('stinkingCloud', (pending) => pending.creatureTargets)

  const handleConfusionConfirm = createConfirmHandler('confusion', async (pending, result) => {
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
  }, (pending) => pending.creatureTargets)

  const handleConfusionSkip = createSkipHandler('confusion', (pending) => pending.creatureTargets)

  const handleHealingWordConfirm = createConfirmHandler('healingWord', async (pending, result) => {
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
  }, (pending) => pending.creatureTargets)

  const handleHealingWordSkip = createSkipHandler('healingWord', (pending) => pending.creatureTargets)

  const handleWebConfirm = createConfirmHandler('web', async (pending, result) => {
    const action = {
      name: pending.spellName,
      spell: pending.spell,
      automation: { type: 'web_area_save', saveDc: pending.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2), saveType: 'DEX' },
      metaCtx: { targets: result },
    }
    await executeHandler(action, playerStats, campaignName, null)
  }, (pending) => pending.creatureTargets)

  const handleWebSkip = createSkipHandler('web', (pending) => pending.creatureTargets)

  return {
    handleAidConfirm, handleAidSkip,
    handleBaneConfirm, handleBaneSkip,
    handleBlessConfirm, handleBlessSkip,
    handleFaerieFireConfirm, handleFaerieFireSkip,
    handleHolyAuraConfirm, handleHolyAuraSkip,
    handleSlowConfirm, handleSlowSkip,
    handleHasteConfirm, handleHasteSkip,
    handleInvisibilityConfirm, handleInvisibilitySkip,
    handleGreaterInvisibilityConfirm, handleGreaterInvisibilitySkip,
    handleFeignDeathConfirm, handleFeignDeathSkip,
    handleHealConfirm, handleHealSkip,
    handleLongstriderConfirm, handleLongstriderSkip,
    handleSpareTheDyingConfirm, handleSpareTheDyingSkip,
    handleBeaconOfHopeConfirm, handleBeaconOfHopeSkip,
    handleHeroesFeastConfirm, handleHeroesFeastSkip,
    handleAuraOfLifeConfirm, handleAuraOfLifeSkip,
    handleAuraOfPurityConfirm, handleAuraOfPuritySkip,
    handleCircleOfPowerConfirm, handleCircleOfPowerSkip,
    handleCompulsionConfirm, handleCompulsionSkip,
    handleAuraOfVitalityConfirm, handleAuraOfVitalitySkip,
    handleDeathWardConfirm, handleDeathWardSkip,
    handleHeroismConfirm, handleHeroismSkip,
    handleGreaterRestorationConfirm, handleGreaterRestorationSkip,
    handleGreaterRestorationNoEffects,
    handleLesserRestorationConfirm, handleLesserRestorationSkip,
    handleRemoveCurseConfirm, handleRemoveCurseSkip,
    handleMageArmorConfirm, handleMageArmorSkip,
    handleForesightConfirm, handleForesightSkip,
    handleProtectionFromEvilAndGoodConfirm, handleProtectionFromEvilAndGoodSkip,
    handleShieldOfFaithConfirm, handleShieldOfFaithSkip,
    handleRegenerateConfirm, handleRegenerateSkip,
    handleSanctuaryConfirm, handleSanctuarySkip,
    handleSleetStormConfirm, handleSleetStormSkip,
    handleCureWoundsConfirm, handleCureWoundsSkip,
    handleHoldMonsterConfirm, handleHoldMonsterSkip,
    handleHoldPersonConfirm, handleHoldPersonSkip,
    handlePolymorphConfirm, handlePolymorphSkip,
    handleAnimalFriendshipConfirm, handleAnimalFriendshipSkip,
    handleCharmPersonConfirm, handleCharmPersonSkip,
    handleCharmMonsterConfirm, handleCharmMonsterSkip,
    handleBanishmentConfirm, handleBanishmentSkip,
    handlePrismaticSprayConfirm, handlePrismaticSpraySkip,
    handleHexConfirm, handleHexSkip,
    handleRevivifyConfirm, handleRevivifySkip,
    handleStinkingCloudConfirm, handleStinkingCloudSkip,
    handleConfusionConfirm, handleConfusionSkip,
    handleHealingWordConfirm, handleHealingWordSkip,
    handleWebConfirm, handleWebSkip,
  }
}
