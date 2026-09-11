import React from 'react'
import { gateMetamagic as executeGateMetamagic } from '../useSpellMetamagicGates.js'
import { useConfirmableFlow } from '../useConfirmableFlow.js'
import { useMetamagicHandler } from './useMetamagicHandler.js'
import { useMultiTargetHandler } from './useMultiTargetHandler.js'
import { useSimpleSpellHandlers } from './useSimpleSpellHandlers.js'
import { useTwoStageHandlers } from './useTwoStageHandlers.js'
import { useCustomHandlers } from './useCustomHandlers.js'
import { useAreaEffectHandlers } from './useAreaEffectHandlers.js'
import { useComplexSpellHandlers } from './useComplexSpellHandlers.js'
import { hasMaterial } from '../../../services/rules/spells/materialComponents.js'
import { buildPendingStates } from './pendingStates.js'

export function useSpellMetamagicFlow(playerStats, campaignName, onExecute, setSecondaryTargetModal, characters = [], setPopupHtml) {
  const isSorcerer = playerStats?.class?.name === 'Sorcerer'
  const { setPending: cfSetPending, getPending, createConfirmHandler, createSkipHandler, clearPending: cfClearPending } = useConfirmableFlow(playerStats, campaignName)

  // Create handler factories
  const { handleConfirm, handleSkip } = useMetamagicHandler(playerStats, campaignName, cfClearPending, getPending, onExecute)
  const { handleConfirm: handleMultiTargetConfirm, handleSkip: handleMultiTargetSkip } = useMultiTargetHandler(playerStats, campaignName, cfClearPending, getPending, onExecute)
  const simpleHandlers = useSimpleSpellHandlers(createConfirmHandler, createSkipHandler, playerStats, campaignName, characters, setPopupHtml, getPending, cfClearPending, onExecute)
  const twoStageHandlers = useTwoStageHandlers(playerStats, campaignName, cfClearPending, getPending, setPopupHtml, characters)
  const customHandlers = useCustomHandlers(playerStats, campaignName, cfClearPending, getPending, setPopupHtml, characters)
  const areaHandlers = useAreaEffectHandlers(createSkipHandler, playerStats, campaignName, cfClearPending, getPending, setPopupHtml)
  const complexHandlers = useComplexSpellHandlers(createConfirmHandler, playerStats, campaignName, cfClearPending, getPending, cfSetPending, setPopupHtml, onExecute, characters)

  // Destructure all handlers from factories
  const {
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
    handleHeroesFeastConfirm, handleHeroesFeastSkip,
    handleLongstriderConfirm, handleLongstriderSkip,
    handleSpareTheDyingConfirm, handleSpareTheDyingSkip,
    handleBeaconOfHopeConfirm, handleBeaconOfHopeSkip,
    handleAuraOfLifeConfirm, handleAuraOfLifeSkip,
    handleAuraOfPurityConfirm, handleAuraOfPuritySkip,
    handleCircleOfPowerConfirm, handleCircleOfPowerSkip,
    handleCompulsionConfirm, handleCompulsionSkip,
    handleAuraOfVitalityConfirm, handleAuraOfVitalitySkip,
    handleConfusionConfirm, handleConfusionSkip,
    handleDeathWardConfirm, handleDeathWardSkip,
    handleHeroismConfirm, handleHeroismSkip,
    handleGreaterRestorationConfirm, handleGreaterRestorationSkip,
    handleGreaterRestorationNoEffects,
    handleLesserRestorationConfirm, handleLesserRestorationSkip,
    handleCureWoundsConfirm, handleCureWoundsSkip,
    handleStinkingCloudConfirm, handleStinkingCloudSkip,
    handleWebConfirm, handleWebSkip,
    handleRemoveCurseConfirm, handleRemoveCurseSkip,
    handleMageArmorConfirm, handleMageArmorSkip,
    handleForesightConfirm, handleForesightSkip,
    handleProtectionFromEvilAndGoodConfirm, handleProtectionFromEvilAndGoodSkip,
    handleShieldOfFaithConfirm, handleShieldOfFaithSkip,
    handleRegenerateConfirm, handleRegenerateSkip,
    handleHealingWordConfirm, handleHealingWordSkip,
    handleSanctuaryConfirm, handleSanctuarySkip,
    handleSleetStormConfirm, handleSleetStormSkip,
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
  } = simpleHandlers

  const {
    resistanceStage,
    protectionFromEnergyStage,
    enhanceAbilityStage,
    handleResistanceTargetSelect, handleResistanceTypeSelect, handleResistanceSkip,
    handleProtectionFromEnergyTargetSelect, handleProtectionFromEnergyTypeSelect, handleProtectionFromEnergySkip,
    handleEnhanceAbilityAbilitySelect, handleEnhanceAbilityConfirm, handleEnhanceAbilitySkip,
  } = twoStageHandlers

  const {
    handleBarkskinConfirm, handleBarkskinSkip,
    handlePassWithoutTraceConfirm, handlePassWithoutTraceSkip,
    handleProtectionFromPoisonConfirm, handleProtectionFromPoisonSkip,
    handleStoneSkinConfirm, handleStoneSkinSkip,
  } = customHandlers

  const {
    handleGlobeConfirm, handleGlobeSkip,
    handleForcecageConfirm, handleForcecageSkip,
    handleAntimagicFieldConfirm, handleAntimagicFieldSkip,
  } = areaHandlers

  const {
    handleAnimalShapesTargetConfirm,
    handleAnimalShapesBeastConfirm,
    handleTruePolymorphPathSelect,
    handleTruePolymorphTargetConfirm,
    handleTruePolymorphSkip,
    handleMagicMissileConfirm,
    handleMagicMissileSkip,
  } = complexHandlers

  const handleAnimalShapesSkip = createSkipHandler('animalShapes', (pending) => pending.creatureTargets)

  const gateMetamagic = React.useCallback(async (spell, metaCtx = {}) => {
    await executeGateMetamagic(spell, metaCtx, {
      hasMaterial, setPopupHtml, isSorcerer, playerStats, campaignName, cfSetPending, setSecondaryTargetModal, characters, onExecute
    })
  }, [isSorcerer, playerStats, campaignName, onExecute, cfSetPending, setSecondaryTargetModal, characters, setPopupHtml])

  // Pending state getters
  const {
    pendingMetamagic, pendingMultiTarget, pendingAid, pendingBane, pendingBless,
    pendingFaerieFire, pendingHolyAura, pendingBeaconOfHope, pendingSlow, pendingHaste,
    pendingEnhanceAbility, pendingBarkskin, pendingInvisibility, pendingGreaterInvisibility,
    pendingFeignDeath, pendingHeal, pendingHeroesFeast, pendingGreaterRestoration,
    pendingLesserRestoration, pendingMageArmor, pendingShieldOfFaith,
    pendingProtectionFromEvilAndGood, pendingProtectionFromPoison, pendingStoneSkin,
    pendingProtectionFromEnergy, pendingResistance, pendingRemoveCurse, pendingMagicMissile,
    pendingPassWithoutTrace, pendingGlobe, pendingForcecage, pendingAntimagicField,
    pendingRegenerate, pendingHealingWord, pendingCureWounds, pendingStinkingCloud, pendingWeb,
    pendingAnimalFriendship, pendingAuraOfLife, pendingAuraOfPurity, pendingCircleOfPower,
    pendingCompulsion, pendingAuraOfVitality, pendingForesight, pendingLongstrider,
    pendingSpareTheDying, pendingPrismaticSpray, pendingConfusion, pendingRevivify,
    pendingSanctuary, pendingSleetStorm, pendingHoldMonster, pendingHoldPerson, pendingPolymorph,
    pendingShapechange, pendingAnimalShapes, pendingTruePolymorph, pendingCharmPerson,
    pendingCharmMonster, pendingBanishment, pendingHeroism, pendingHex, pendingDeathWard,
  } = buildPendingStates(getPending)

  return {
    pendingMetamagic, pendingMultiTarget, pendingAid, pendingBane, pendingShapechange, pendingBless, pendingFaerieFire,
    handleFaerieFireConfirm, handleFaerieFireSkip, pendingHolyAura, pendingBeaconOfHope, pendingSlow, pendingHaste,
    pendingEnhanceAbility, pendingBarkskin, pendingInvisibility, pendingGreaterInvisibility, pendingHeal,
    pendingHeroesFeast, pendingGreaterRestoration, handleGreaterRestorationConfirm, handleGreaterRestorationSkip, pendingLesserRestoration, pendingMageArmor, pendingShieldOfFaith,
    pendingProtectionFromEvilAndGood, pendingProtectionFromPoison, pendingStoneSkin, pendingProtectionFromEnergy,
    pendingResistance, pendingRemoveCurse, pendingMagicMissile, pendingPassWithoutTrace, pendingGlobe, pendingForcecage,
    pendingAntimagicField, pendingRegenerate, handleRegenerateConfirm, handleRegenerateSkip, pendingHealingWord, handleHealingWordConfirm, handleHealingWordSkip, pendingCureWounds, handleCureWoundsConfirm, handleCureWoundsSkip, pendingStinkingCloud, handleStinkingCloudConfirm, handleStinkingCloudSkip, pendingWeb, handleWebConfirm, handleWebSkip,
    pendingAnimalFriendship, pendingAuraOfLife, pendingAuraOfPurity, pendingCircleOfPower, pendingCompulsion,
    pendingAuraOfVitality, pendingForesight,     pendingLongstrider, handleLongstriderConfirm, handleLongstriderSkip,
    pendingSpareTheDying, handleSpareTheDyingConfirm, handleSpareTheDyingSkip,
    pendingPrismaticSpray,
    handlePrismaticSprayConfirm, handlePrismaticSpraySkip,
    pendingRevivify, handleRevivifyConfirm, handleRevivifySkip,
    pendingConfusion, handleConfusionConfirm, handleConfusionSkip,
    pendingSanctuary, handleSanctuaryConfirm, handleSanctuarySkip, pendingSleetStorm, handleSleetStormConfirm, handleSleetStormSkip,
    pendingAnimalShapes, handleAnimalShapesTargetConfirm, handleAnimalShapesSkip, handleAnimalShapesBeastConfirm,
    pendingTruePolymorph, handleTruePolymorphPathSelect, handleTruePolymorphTargetConfirm, handleTruePolymorphSkip,
    handleGlobeConfirm, handleGlobeSkip, handleForcecageConfirm, handleForcecageSkip, handleAntimagicFieldConfirm, handleAntimagicFieldSkip,
    pendingHoldMonster, handleHoldMonsterConfirm, handleHoldMonsterSkip,
    pendingHoldPerson, handleHoldPersonConfirm, handleHoldPersonSkip,
    pendingPolymorph, handlePolymorphConfirm, handlePolymorphSkip,
    pendingCharmPerson, handleCharmPersonConfirm, handleCharmPersonSkip,
    pendingCharmMonster, handleCharmMonsterConfirm, handleCharmMonsterSkip,
    pendingBanishment, handleBanishmentConfirm, handleBanishmentSkip,
    pendingDeathWard, handleDeathWardConfirm, handleDeathWardSkip,
    pendingHeroism, handleHeroismConfirm, handleHeroismSkip,
    pendingHex, handleHexConfirm, handleHexSkip,
    handleAnimalFriendshipConfirm, handleAnimalFriendshipSkip,
    resistanceStage, enhanceAbilityStage, protectionFromEnergyStage,
    handleResistanceTargetSelect, handleResistanceTypeSelect, handleResistanceSkip,
    handleProtectionFromEnergyTargetSelect, handleProtectionFromEnergyTypeSelect, handleProtectionFromEnergySkip,
    handleEnhanceAbilityAbilitySelect, handleEnhanceAbilityConfirm, handleEnhanceAbilitySkip,
    gateMetamagic, handleConfirm, handleSkip, handleMultiTargetConfirm, handleMultiTargetSkip,
    handleAidConfirm, handleAidSkip, handleBaneConfirm, handleBaneSkip, handleBlessConfirm, handleBlessSkip,
    handleHolyAuraConfirm, handleHolyAuraSkip, handleBeaconOfHopeConfirm, handleBeaconOfHopeSkip,
    handleSlowConfirm, handleSlowSkip, handleHasteConfirm, handleHasteSkip,
    handleBarkskinConfirm, handleBarkskinSkip, handleInvisibilityConfirm, handleInvisibilitySkip,
    handleGreaterInvisibilityConfirm, handleGreaterInvisibilitySkip, pendingFeignDeath,
    handleFeignDeathConfirm, handleFeignDeathSkip, handleHealConfirm, handleHealSkip,
    handleHeroesFeastConfirm, handleHeroesFeastSkip, handleAuraOfLifeConfirm, handleAuraOfLifeSkip,
    handleAuraOfPurityConfirm, handleAuraOfPuritySkip, handleCircleOfPowerConfirm, handleCircleOfPowerSkip,
    handleCompulsionConfirm, handleCompulsionSkip, handleAuraOfVitalityConfirm, handleAuraOfVitalitySkip,
    handleLesserRestorationConfirm, handleLesserRestorationSkip,
    handleRemoveCurseConfirm, handleRemoveCurseSkip, handleMageArmorConfirm, handleMageArmorSkip,
    handleForesightConfirm, handleForesightSkip, handleProtectionFromEvilAndGoodConfirm,
    handleProtectionFromEvilAndGoodSkip, handleShieldOfFaithConfirm, handleShieldOfFaithSkip,
    handleProtectionFromPoisonConfirm, handleProtectionFromPoisonSkip, handleStoneSkinConfirm,
    handleStoneSkinSkip, handlePassWithoutTraceConfirm, handlePassWithoutTraceSkip, handleGreaterRestorationNoEffects,
    handleMagicMissileConfirm, handleMagicMissileSkip,
    cfClearPending,
  }
}
