import { handle as handleSaveOnly } from './handlers/combat/saveOnlyHandler.js';
import { handle as handleSaveAttack } from './handlers/combat/saveAttackHandler.js';
import { handle as handleHealing } from './handlers/healing/healingHandler.js';
import { handle as handleMassHeal } from './handlers/healing/massHealHandler.js';
import { handle as handleMassCureWounds } from './handlers/healing/massCureWoundsHandler.js';
import { handle as handlePrayerOfHealing } from './handlers/healing/prayerOfHealingHandler.js';
import { handle as handleMassHealingWord } from './handlers/healing/massHealingWordHandler.js';
import { handle as handleBuff } from './handlers/buffs/buffHandler.js';
import { handle as handlePowerWordFortify } from './handlers/buffs/powerWordFortifyHandler.js';
import { handle as handleCondition } from './handlers/buffs/conditionHandler.js';
import { handle as handleTelekineticShove } from './handlers/feats/telekineticShoveHandler.js';
import { handle as handleSorcery } from './handlers/resources/sorceryHandler.js';
import { handle as handleSpellCast } from './handlers/spells/spellCastHandler.js';
import { handle as handleRegenerate, applyRegenerateEffect } from './handlers/spells/regenerateHandler.js';
import { handle as handleAnimateDead, confirmAnimateDead as handleAnimateDeadConfirm } from './handlers/spells/animateDeadHandler.js';
import { handle as handleCreateUndead, confirmCreateUndead as handleCreateUndeadConfirm } from './handlers/spells/createUndeadHandler.js';
import { handle as handleSummonSpirit, confirmSummonSpirit as handleSummonSpiritConfirm } from './handlers/spells/summonSpiritHandler.js';
import { handle as handleInitiative } from './handlers/combat/initiativeHandler.js';

import { handle as handleResourcePool } from './handlers/resources/resourcePoolHandler.js';
import { handle as handleNaturalRecovery } from './handlers/resources/naturalRecoveryHandler.js';
import { handle as handleCircleOfTheLandSpells } from './handlers/class-druid/circleOfTheLandSpellsHandler.js';
import { handle as handleWrathOfTheSea } from './handlers/class-druid/wrathOfTheSeaHandler.js';
import { handle as handleOceanicGift } from './handlers/class-druid/oceanicGiftHandler.js';
import { handle as handleFontOfMagic } from './handlers/resources/fontOfMagicHandler.js';
import { handle as handleHealingPool } from './handlers/healing/healingPoolHandler.js';
import { automationInfoPopup } from '../shared/popupResponse.js';
import { handle as handleCombatStance } from './handlers/combat/combatStanceHandler.js';
import { handle as handleStrideOfTheElements } from './handlers/combat/strideOfTheElementsHandler.js';
import { handle as handleElementalEpitome } from './handlers/combat/elementalEpitomeHandler.js';
import { handle as handleDestructiveStride } from './handlers/combat/destructiveStrideHandler.js';
import { handle as handleReactionDamage } from './handlers/reactions/reactionDamageHandler.js';
import { handle as handlePersistentRage } from './handlers/class-barbarian/persistentRageHandler.js';
import { handle as handleZealousPresence } from './handlers/class-barbarian/zealousPresenceHandler.js';
import { handle as handleReactionDebuff } from './handlers/reactions/reactionDebuffHandler.js';
import { handle as handleReactionSpell } from './handlers/reactions/reactionSpellHandler.js';
import { handle as handleInterception } from './handlers/reactions/interceptionHandler.js';
import { handle as handleBoonOfEnergyResistance, applyTypeChoice as applyBoonOfEnergyResistance } from './handlers/reactions/boonOfEnergyResistanceHandler.js';
import { handle as handleBoonOfFate } from './handlers/reactions/boonOfFateHandler.js';
import { handle as handleBoonOfRecovery } from './handlers/reactions/boonOfRecoveryHandler.js';
import { handle as handleLuckyPoint } from './handlers/reactions/luckyPointHandler.js';
import { handle as handleAttackRider } from './handlers/combat/attackRiderHandler.js';
import { handle as handleTempHpBuff } from './handlers/buffs/tempHpBuffHandler.js';
import { handle as handleWeaponMastery } from './handlers/combat/weaponMasteryHandler.js';
import { handle as handleWeaponMasteryChoice, applyMasterySelection as applyWeaponMasteryChoice } from './handlers/combat/weaponMasteryChoiceHandler.js';
import { handle as handleWeaponKindMastery, applySelections as applyWeaponKindMastery } from './handlers/combat/weaponKindMasteryHandler.js';
import { handle as handleBuffAlly } from './handlers/buffs/buffAllyHandler.js';
import { handle as handleEncouragingSong } from './handlers/buffs/encouragingSongHandler.js';
import { handle as handleHaste, applyHaste, isHasteActive } from './handlers/buffs/hasteHandler.js';
import { handle as handleBarkskin, applyBarkskin as applyBarkskinEffect, isBarkskinActive } from './handlers/buffs/barkskinHandler.js';
import { handle as handleInvisibility, applyInvisibility, isInvisibilityActive } from './handlers/buffs/invisibilityHandler.js';
import { handle as handleGreaterInvisibility, applyGreaterInvisibility, isGreaterInvisibilityActive } from './handlers/buffs/greaterInvisibilityHandler.js';
import { handle as handleDeathWard, applyDeathWard as applyDeathWardEffect, isDeathWardActive } from './handlers/buffs/deathWardHandler.js';
import { handle as handleRevivification } from './handlers/healing/revivificationHandler.js';
import { handle as handleBardicInspiration } from './handlers/class-bard/bardicInspirationHandler.js';
import { handle as handleAutoReroll } from './handlers/combat/autoRerollHandler.js';
import { handle as handleBardicInspirationUse } from './handlers/class-bard/bardicInspirationUseHandler.js';
import { handle as handleReactionBonus } from './handlers/reactions/reactionBonusHandler.js';
import { handle as handlePostCastRider } from './handlers/combat/postCastRiderHandler.js';
import { handle as handleBardicInspirationDefense } from './handlers/class-bard/bardicInspirationDefenseHandler.js';
import { handle as handleBardicInspirationOffense } from './handlers/class-bard/bardicInspirationOffenseHandler.js';
import { handle as handleDivineSpark } from './handlers/class-cleric-paladin/divineSparkHandler.js';
import { handle as handleDivineIntervention } from './handlers/class-cleric-paladin/divineInterventionHandler.js';
import { handle as handleBonusActionAttack } from './handlers/combat/bonusActionAttackHandler.js';
import { handle as handleExtraAction } from './handlers/combat/extraActionHandler.js';
import { handle as handleDamageReduction } from './handlers/combat/damageReductionHandler.js';
import { handle as handleOpenHandTechnique } from './handlers/class-fighter-rogue/openHandTechniqueHandler.js';
import { handle as handleQuiveringPalm } from './handlers/class-monk/quiveringPalmHandler.js';
import { handle as handleReactionSaveHeal } from './handlers/reactions/reactionSaveHealHandler.js';
import { handle as handleCountercharm } from './handlers/class-bard/countercharmHandler.js';
import { handle as handleFontOfInspiration } from './handlers/class-bard/fontOfInspirationHandler.js';
import { handle as handleAgileStrike } from './handlers/class-bard/agileStrikeHandler.js';
import { handle as handleMultiTarget } from './handlers/combat/multiTargetHandler.js';
import { handle as handleDivineOrder } from './handlers/class-cleric-paladin/divineOrderHandler.js';
import { handle as handleNaturesSanctuary, handleMove as handleNaturesSanctuaryMove } from './handlers/class-ranger/naturesSanctuaryHandler.js';
import { handle as handleStarryForm } from './handlers/class-sorcerer/starryFormHandler.js';
import { handle as handleStarryFormArrow } from './handlers/class-sorcerer/starryFormArrowHandler.js';
import { handle as handleCosmicOmen } from './handlers/class-sorcerer/cosmicOmenHandler.js';
import { handle as handleTwinklingConstellation } from './handlers/class-sorcerer/twinklingConstellationHandler.js';
import { handle as handleTacticalMind } from './handlers/class-fighter-rogue/tacticalMindHandler.js';
import { handle as handleCombatSuperiority } from './handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { handleCombatSuperiorityBonusAction, handleCombatSuperiorityReaction, handleCombatSuperiorityGrantAttack, handleCombatSuperiorityMovement, handleCombatSuperioritySkillCheck, handleCombatSuperiorityCommandingPresenceReaction, handleCombatSuperioritySweepingAttack, handleAttackRiderPrompt, handleSkillCheckPrompt } from './handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { handle as handleKnowEnemy } from './handlers/class-fighter-rogue/knowEnemyHandler.js';
import { handle as handleWarBond } from './handlers/class-fighter-rogue/warBondHandler.js';
import { handle as handleWarMagicCantrip } from './handlers/class-fighter-rogue/warMagicCantripHandler.js';
import { handle as handleWarMagicSpell } from './handlers/class-fighter-rogue/warMagicSpellHandler.js';
import { handle as handleArcaneCharge } from './handlers/class-sorcerer/arcaneChargeHandler.js';
import { handle as handlePsionicStrike } from './handlers/class-sorcerer/psionicStrikeHandler.js';
import { handle as handleProtectiveField } from './handlers/class-sorcerer/protectiveFieldHandler.js';
import { handle as handleTelekineticMovement } from './handlers/class-sorcerer/telekineticMovementHandler.js';
import { handle as handleTelekineticLeap } from './handlers/class-sorcerer/telekineticLeapHandler.js';
import { handle as handleTelekineticThrust } from './handlers/class-sorcerer/telekineticThrustHandler.js';
import { handle as handleGuardedMind } from './handlers/class-sorcerer/guardedMindHandler.js';
import { handle as handleBulwarkOfForce } from './handlers/class-sorcerer/bulwarkOfForceHandler.js';
import { handle as handleConcentrationBonusAttack } from './handlers/combat/concentrationBonusAttackHandler.js';
import { handle as handleGiantAncestry, handleCloudsJauntDirect as handleCloudsJaunt, handleFiresBurnDirect as handleFiresBurn, handleFrostsChillDirect as handleFrostsChill, handleHillsTumbleDirect as handleHillsTumble, handleStonesEnduranceDirect as handleStonesEndurance, handleStormsThunderDirect as handleStormsThunder } from './handlers/class-other/giantAncestryHandler.js';
import { handle as handleDamageTypeModifier } from './handlers/combat/damageTypeModifierHandler.js';
import { handle as handleSuperiorDefense } from './handlers/superiorDefenseHandler.js';
import { handle as handleHandOfUltimateMercy } from './handlers/class-cleric-paladin/handOfUltimateMercyHandler.js';
import { handle as handleCloakOfShadows } from './handlers/class-cleric-paladin/cloakOfShadowsHandler.js';
import { handle as handleSacredWeapon } from './handlers/class-cleric-paladin/sacredWeaponHandler.js';
import { handle as handleSmiteOfProtection } from './handlers/class-cleric-paladin/smiteOfProtectionHandler.js';
import { handle as handleHolyNimbus } from './handlers/class-cleric-paladin/holyNimbusHandler.js';
import { handle as handleInspiringSmite } from './handlers/class-cleric-paladin/inspiringSmiteHandler.js';
import { handle as handlePeerlessAthlete } from './handlers/class-cleric-paladin/peerlessAthleteHandler.js';
import { handle as handleGloriousDefense } from './handlers/class-cleric-paladin/gloriousDefenseHandler.js';
import { handle as handleProtectionFromEnergy, applyProtectionFromEnergy as applyProtectionFromEnergyHandler } from './handlers/buffs/protectionFromEnergyHandler.js';
import { handle as handleProtectionFromPoison, applyProtectionFromPoison as applyProtectionFromPoisonHandler, isProtectionFromPoisonActive } from './handlers/buffs/protectionFromPoisonHandler.js';
import { handle as handleStoneSkin, applyStoneSkin as applyStoneSkinHandler, isStoneSkinActive, getStoneSkinDamageTypes } from './handlers/buffs/stoneSkinHandler.js';
import { handle as handleLivingLegend } from './handlers/class-cleric-paladin/livingLegendHandler.js';
import { handle as handleUndyingSentinel } from './handlers/class-cleric-paladin/undyingSentinelHandler.js';
import { handle as handleElderChampion } from './handlers/class-cleric-paladin/elderChampionHandler.js';
import { handle as handleVowOfEnmity } from './handlers/class-cleric-paladin/vowOfEnmityHandler.js';
import { handle as handleRelentlessAvenger } from './handlers/class-cleric-paladin/relentlessAvengerHandler.js';
import { handle as handleRelentlessEndurance } from './handlers/class-cleric-paladin/relentlessEnduranceHandler.js';
import { handle as handleSoulOfVengeance } from './handlers/class-cleric-paladin/soulOfVengeanceHandler.js';
import { handle as handleAvengingAngel } from './handlers/class-cleric-paladin/avengingAngelHandler.js';
import { handle as handleRadianceOfDawn } from './handlers/class-cleric-paladin/radianceOfDawnHandler.js';
import { handle as handlePrimalCompanionSummon, confirmPrimalCompanionSummon as handlePrimalCompanionSummonConfirm, handleCommand as handlePrimalCompanionCommand, handleRestore as handlePrimalCompanionRestore, handleBonusActionCommand as handlePrimalCompanionBonusActionCommand, applyBonusActionCommand as applyPrimalCompanionBonusActionCommand } from './handlers/class-ranger/primalCompanionHandler.js';
import { handle as handlePrimalCompanionSpellShare, applySpellShare as applyPrimalCompanionSpellShare } from './handlers/class-ranger/primalCompanionSpellShareHandler.js';
import { handle as handleBeguilingTwist } from './handlers/class-ranger/beguilingTwistHandler.js';
import { handle as handleFeyReinforcements, confirmFeyReinforcement as handleFeyReinforcementsConfirm } from './handlers/class-warlock/feyReinforcementsHandler.js';
import { handle as handleMistyWanderer, confirmMistyWanderer as handleMistyWandererConfirm } from './handlers/class-warlock/mistyWandererHandler.js';
import { handle as handleShadowyDodge } from './handlers/class-ranger/shadowyDodgeHandler.js';
import { handle as handleMistyEscape } from './handlers/class-warlock/mistyEscapeHandler.js';
import { handle as handleHunterPrey } from './handlers/class-ranger/hunterPreyHandler.js';
import { handle as handleDefensiveTactics } from './handlers/class-ranger/defensiveTacticsHandler.js';
import { handle as handleSuperiorHunterPrey } from './handlers/class-ranger/superiorHunterPreyHandler.js';
import { handle as handleSuperiorHunterDefense } from './handlers/class-ranger/superiorHunterDefenseHandler.js';
import { handle as handleDreadAmbushDamage } from './handlers/class-ranger/dreadAmbushHandler.js';
import { handle as handleNaturesVeil } from './handlers/class-ranger/naturesVeilHandler.js';
import { handle as handleTireless } from './handlers/class-ranger/tirelessHandler.js';
import { handle as handleBonusActionChoice } from './handlers/combat/bonusActionChoiceHandler.js';
import { handle as handleBonusAttacks } from './handlers/combat/bonusAttacksHandler.js';
import { handle as handlePatientDefense } from './handlers/combat/patientDefenseHandler.js';
import { handle as handleStepOfTheWind } from './handlers/combat/stepOfTheWindHandler.js';
import { handle as handleElementalAttunement } from './handlers/combat/elementalAttunementHandler.js';
import { handle as handleElementalBurst } from './handlers/combat/elementalBurstHandler.js';
import { handle as handleSteadyAim } from './handlers/class-fighter-rogue/steadyAimHandler.js';
import { handle as handleMageHandControl } from './handlers/class-fighter-rogue/mageHandControlHandler.js';
import { handle as handleSpellThief } from './handlers/class-fighter-rogue/spellThiefHandler.js';
import { handle as handlePsychicTeleportation } from './handlers/class-sorcerer/psychicTeleportationHandler.js';
import { handle as handleFastHands } from './handlers/class-fighter-rogue/fastHandsHandler.js';
import { handle as handleStealthAttack } from './handlers/class-fighter-rogue/stealthAttackHandler.js';
import { handle as handleUseMagicDevice } from './handlers/class-fighter-rogue/useMagicDeviceHandler.js';
import { handle as handleRevelationInFlesh } from './handlers/class-warlock/revelationInFleshHandler.js';
import { handle as handleWarpingImplosion } from './handlers/class-sorcerer/warpingImplosionHandler.js';
import { handle as handleRestoreBalance } from './handlers/class-sorcerer/restoreBalanceHandler.js';
import { handle as handleBastionOfLaw, handleSpendDice as handleBastionOfLawSpend } from './handlers/class-cleric-paladin/bastionOfLawHandler.js';
import { handle as handleTranceOfOrder } from './handlers/class-cleric-paladin/tranceOfOrderHandler.js';
import { handle as handleClockworkCavalcade } from './handlers/class-sorcerer/clockworkCavalcadeHandler.js';
import { handle as handleElementalAffinity } from './handlers/class-sorcerer/elementalAffinityHandler.js';
import { handle as handleDragonWings } from './handlers/class-sorcerer/dragonWingsHandler.js';
import { handle as handleDragonCompanion, confirmDragonCompanion as handleDragonCompanionConfirm } from './handlers/class-sorcerer/dragonCompanionHandler.js';
import { handle as handleWildMagicSurge, handleTamedSurge as handleWildMagicTamed, handleFeatsOfChaos as handleFeatsOfChaosAdvantage, onTamedSurgeSelected as onWildMagicTamedSelected, onDoubleRollSelected } from './handlers/class-sorcerer/wildMagicSurgeHandler.js';
import { handle as handleMagicalCunning } from './handlers/class-wizard/magicalCunningHandler.js';
import { handle as handleContactPatron } from './handlers/class-warlock/contactPatronHandler.js';
import { handle as handleBeguilingDefenses } from './handlers/class-warlock/beguilingDefensesHandler.js';
import { handle as handleBewitchingMagic } from './handlers/class-warlock/bewitchingMagicHandler.js';
import { handle as handleStepsOfTheFey } from './handlers/class-warlock/stepsOfTheFeyHandler.js';
import { handle as handleCelestialResilience } from './handlers/class-warlock/celestialResilienceHandler.js';
import { handle as handleSearingVengeance } from './handlers/class-warlock/searingVengeanceHandler.js';
import { handle as handleDarkOnesLuck } from './handlers/class-warlock/darkOnesLuckHandler.js';
import { handle as handleFiendishResilience } from './handlers/class-warlock/fiendishResilienceHandler.js';
import { handle as handleHurlThroughHell } from './handlers/class-warlock/hurlThroughHellHandler.js';
import { handle as handleClairvoyantCombatant } from './handlers/class-warlock/clairvoyantCombatantHandler.js';
import { handle as handlePsychicSpells } from './handlers/class-warlock/psychicSpellsHandler.js';
import { handle as handleCreateThrallTempHp } from './handlers/class-warlock/createThrallTempHpHandler.js';
import { handle as handleSpellMastery } from './handlers/class-wizard/spellMasteryHandler.js';
import { handle as handleSignatureSpells } from './handlers/class-wizard/signatureSpellsHandler.js';
import { handle as handleArcaneWard } from './handlers/class-wizard/arcaneWardHandler.js';
import { handle as handleArcaneWardBonusActionRestore } from './handlers/class-wizard/arcaneWardHandler.js';
import { handle as handleArcaneVigor } from './handlers/spells/arcaneVigorHandler.js';
import { handle as handlePortent } from './handlers/class-wizard/portentHandler.js';
import { handle as handleExpertDivination } from './handlers/class-wizard/expertDivinationHandler.js';
import { handle as handleThirdEye } from './handlers/class-wizard/thirdEyeHandler.js';
import { handle as handleSoulstitchSpells } from './handlers/class-wizard/soulstitchSpellsHandler.js';
import { handle as handleOverchannel } from './handlers/class-wizard/overchannelHandler.js';
import { handle as handlePhantasmalCreatures, confirmPhantasmalCreatures as handlePhantasmalCreaturesConfirm } from './handlers/class-wizard/phantasmalCreaturesHandler.js';
import { handle as handleIllusorySelf } from './handlers/class-wizard/illusorySelfHandler.js';
import { handle as handleIllusoryReality, confirmIllusoryReality as handleIllusoryRealityConfirm } from './handlers/class-wizard/illusoryRealityHandler.js';
import { handle as handleCelestialRevelation } from './handlers/class-sorcerer/celestialRevelationHandler.js';
import { handle as handleStonecunning } from './handlers/class-other/stonecunningHandler.js';
import { handle as handleElfisLineage } from './handlers/class-other/elfishLineageHandler.js';
import { handle as handleGnomishLineage } from './handlers/class-other/gnomishLineageHandler.js';
import { handle as handleLargeForm } from './handlers/class-other/largeFormHandler.js';
import { handle as handleFiendishLegacy } from './handlers/class-other/fiendishLegacyHandler.js';
import { handle as handleAid, applyAid as applyAidEffect } from './handlers/healing/aidHandler.js';
import { applyBaneEffect } from '../../services/rules/features/baneService.js';
import { applyBlessEffect } from '../../services/rules/features/blessService.js';
import { handle as handleHolyAura, applyHolyAura as applyHolyAuraEffect } from './handlers/buffs/holyAuraHandler.js';
import { handle as handleAuraOfLife, applyAuraOfLife as applyAuraOfLifeEffect, isAuraOfLifeActive } from './handlers/buffs/auraOfLifeHandler.js';
import { handle as handleAuraOfPurity, applyAuraOfPurity as applyAuraOfPurityEffect, isAuraOfPurityActive } from './handlers/buffs/auraOfPurityHandler.js';
import { handle as handleAuraOfVitality, applyAuraOfVitality as applyAuraOfVitalityEffect, isAuraOfVitalityActive } from './handlers/buffs/auraOfVitalityHandler.js';
import { handle as handleCircleOfPower, applyCircleOfPower as applyCircleOfPowerEffect, isCircleOfPowerActive } from './handlers/buffs/circleOfPowerHandler.js';
import { handle as handleBladeWard } from './handlers/buffs/bladeWardHandler.js';
import { handle as handleShield } from './handlers/shieldHandler.js';
import { handle as handleShieldOfFaith, applyShieldOfFaith as applyShieldOfFaithEffect, isShieldOfFaithActive, getShieldOfFaithBonus } from './handlers/shieldOfFaithHandler.js';
import { handle as handleCounterSpell } from './handlers/spells/counterSpellHandler.js';
import { handle as handleBlindnessDeafness } from './handlers/spells/blindnessDeafnessHandler.js';
import { handle as handleEyebite } from './handlers/spells/eyebiteHandler.js';
import { handle as handleFalseLife } from './handlers/buffs/falseLifeHandler.js';
import { handle as handleHeroism, applyHeroism, isHeroismActive } from '../../services/rules/features/heroismService.js';
import { handle as handleFear } from './handlers/spells/fearHandler.js';
import { handle as handleFeignDeath, applyFeignDeath } from './handlers/spells/feignDeathHandler.js';
import { handle as handleFleshToStone } from './handlers/spells/fleshToStoneHandler.js';
import { handle as handleHoldMonster } from './handlers/spells/holdMonsterHandler.js';
import { handle as handleBanishment } from './handlers/spells/banishmentHandler.js';
import { handle as handlePolymorph } from './handlers/spells/polymorphHandler.js';
import { handle as handleTruePolymorph } from './handlers/spells/truePolymorphHandler.js';
import { handle as handleShapechange } from './handlers/spells/shapechangeHandler.js';
import { handle as handleMaze, handleEscape as handleMazeEscape, removeMazeEffect } from './handlers/spells/mazeHandler.js';
import { handle as handleFriends } from './handlers/spells/friendsHandler.js';
import { handle as handleForesight } from './handlers/spells/foresightHandler.js';
import { handle as handleCharmPerson } from './handlers/spells/charmPersonHandler.js';
import { handle as handleCharmMonster } from './handlers/spells/charmMonsterHandler.js';
import { handle as handleCompulsion } from './handlers/spells/compulsionHandler.js';
import { applyCompulsionEffect } from '../../services/rules/features/compulsionService.js';
import { handle as handleCrownOfMadness } from './handlers/spells/crownOfMadnessHandler.js';
import { triggerCrownOfMadness } from '../../services/rules/features/crownOfMadnessService.js';
import { handle as handleAnimalFriendship } from './handlers/spells/animalFriendshipHandler.js';
import { handle as handleAnimalShapes } from './handlers/spells/animalShapesHandler.js';
import { handle as handleDominate } from './handlers/spells/dominateHandler.js';
import { handle as handleSleep } from './handlers/spells/sleepHandler.js';
import { handle as handleSleepShake } from './handlers/spells/sleepShakeHandler.js';
import { handle as handleGlobeOfInvulnerability } from './handlers/spells/globeOfInvulnerabilityHandler.js';
import { handle as handleAntimagicField } from './handlers/spells/antimagicFieldHandler.js';
import { handle as handleGreaseAreaSave } from './handlers/spells/greaseAreaSaveHandler.js';
import { handle as handleGreaterRestoration, applyGreaterRestoration as applyGreaterRestorationEffect } from './handlers/spells/greaterRestorationHandler.js';
import { handle as handleLesserRestoration, applyLesserRestoration as applyLesserRestorationEffect } from './handlers/spells/lesserRestorationHandler.js';
import { handle as handleRemoveCurse, applyRemoveCurse as applyRemoveCurseEffect } from './handlers/spells/removeCurseHandler.js';
import { handle as handleLongstrider, applyLongstrider as applyLongstriderEffect } from './handlers/buffs/longstriderHandler.js';
import { handle as handleSpareTheDying, applySpareTheDying as applySpareTheDyingEffect } from './handlers/spells/spareTheDyingHandler.js';
import { handle as handleMageArmor, applyMageArmor as applyMageArmorEffect } from './handlers/buffs/mageArmorHandler.js';
import { handle as handleHeroesFeast, applyHeroesFeast as applyHeroesFeastEffect } from './handlers/buffs/heroesFeastHandler.js';
import { handle as handleHypnoticPatternShake, handleConfirm as handleHypnoticPatternShakeConfirm } from './handlers/spells/hypnoticPatternShake.js';
import { handle as handleHypnoticPattern } from './handlers/spells/hypnoticPatternHandler.js';
import { handle as handleMassSuggestion } from './handlers/spells/massSuggestionHandler.js';
import { handle as handleSuggestion } from './handlers/spells/suggestionHandler.js';
import { handle as handleCommand } from './handlers/spells/commandHandler.js';
import { handle as handleCalmEmotions } from './handlers/spells/calmEmotionsHandler.js';
import { handle as handleSilence } from './handlers/spells/silenceHandler.js';
import { handle as handleBane } from './handlers/spells/baneHandler.js';
import { handle as handleBless } from './handlers/spells/blessHandler.js';
import { handle as handleBeaconOfHope } from './handlers/spells/beaconOfHopeHandler.js';
import { applyBeaconOfHopeEffect } from './handlers/spells/beaconOfHopeHandler.js';
import { handle as handleSlow } from './handlers/spells/slowHandler.js';
import { handle as handleResilientSphere } from './handlers/spells/resilientSphereHandler.js';
import { handle as handleFreezingSphere } from './handlers/spells/freezingSphereHandler.js';
import { handle as handlePowerWordStun } from './handlers/spells/powerWordStunHandler.js';
import { handle as handleWardingBond, getWardingBondTarget, getWardingBondSource, isWardingBondActive } from './handlers/spells/wardingBondHandler.js';
import { handle as handleOttoDance } from './handlers/spells/ottosDanceHandler.js';
import { handle as handleStinkingCloud } from './handlers/spells/stinkingCloudHandler.js';
import { handle as handleConfusion } from './handlers/spells/confusionHandler.js';
import { handle as handleTashasLaughter } from './handlers/spells/tashasLaughterHandler.js';
import { handle as handleImprisonment } from './handlers/spells/imprisonmentHandler.js';
import { handle as handlePrismaticSpray } from './handlers/spells/prismaticSprayHandler.js';
import { handle as handlePassWithoutTrace } from './handlers/buffs/passWithoutTraceHandler.js';
import { applyPassWithoutTraceEffect } from '../../services/rules/features/passWithoutTraceService.js';
import { handle as handleProtectionFromEvilAndGood, applyProtectionFromEvilAndGood, isProtectionFromEvilAndGoodActive, isCreatureWarded } from './handlers/buffs/protectionFromEvilAndGoodHandler.js';
import { handle as handleResistance, applyResistance as applyResistanceEffect, getResistanceDamageType, isResistanceUsedThisTurn } from './handlers/buffs/resistanceHandler.js';
import { handle as handleRayOfEnfeeblement, isRayOfEnfeeblementActive } from './handlers/spells/rayOfEnfeeblementHandler.js';
import { handle as handleCompelledDuel, isCompelledDuelActive, checkCompelledDuelAttackExpiry, endCompelledDuel } from './handlers/spells/compelledDuelHandler.js';
import { handle as handleSanctuary, isSanctuaryActive, endSanctuary, getSanctuaryTarget } from './handlers/spells/sanctuaryHandler.js';
import { handle as handleViciousMockery } from './handlers/spells/viciousMockeryHandler.js';
import { handle as handleSentinelGuardian } from './handlers/combat/sentinelGuardianHandler.js';
import { handle as handleSentinelHalt } from './handlers/combat/sentinelHaltHandler.js';
import { handle as handleWebAreaSave } from './handlers/spells/webAreaSaveHandler.js';
import { handle as handleEnhanceAbility, applyEnhanceAbility as applyEnhanceAbilityEffect } from './handlers/spells/enhanceAbilityHandler.js';
import { handle as handleSavant } from './handlers/class-wizard/SavantHandler.js';
import { handle as handleFaerieFire } from './handlers/spells/faerieFireHandler.js';
import { handle as handleForcecage, handleEscape as handleForcecageEscape } from './handlers/spells/forcecageHandler.js';
import { handle as handleSleetStorm } from './handlers/spells/sleetStormHandler.js';

const SAVANT_SCHOOLS = {
    abjuration_savant: 'Abjuration',
    divination_savant: 'Divination',
    evocation_savant: 'Evocation',
    illusion_savant: 'Illusion',
};

function makeSavantHandler(effect) {
    const school = SAVANT_SCHOOLS[effect];
    return school ? (action, playerStats, campaignName, mapName) => handleSavant(action, playerStats, campaignName, mapName, school) : null;
}

const PASSIVE_RULE_EFFECTS = {
    abjuration_savant: makeSavantHandler('abjuration_savant'),
    divination_savant: makeSavantHandler('divination_savant'),
    evocation_savant: makeSavantHandler('evocation_savant'),
    illusion_savant: makeSavantHandler('illusion_savant'),
    persistent_rage: handlePersistentRage,
    superior_defense: handleSuperiorDefense,
};

const HANDLER_MAP = {
    save_only: handleSaveOnly,
    save_attack: handleSaveAttack,
    healing: handleHealing,
    self_healing: handleHealing,
    mass_heal: handleMassHeal,
    mass_cure_wounds: handleMassCureWounds,
    prayer_of_healing: handlePrayerOfHealing,
    mass_healing_word: handleMassHealingWord,
    power_word_fortify: handlePowerWordFortify,
    temp_buff: handleBuff,
    set_condition: handleCondition,
    sorcery_aura: handleSorcery,
    sorcery_incarnate: handleSorcery,
    free_spell: handleSpellCast,
    initiative_action: handleInitiative,
    bonus_action_attack: handleBonusActionAttack,
    buff_ally: handleBuffAlly,
    death_ward: handleDeathWard,
    zealous_presence: handleZealousPresence,
    resource_pool: handleResourcePool,
    natural_recovery: handleNaturalRecovery,
    circle_of_the_land_spells: handleCircleOfTheLandSpells,
    wrath_of_the_sea: handleWrathOfTheSea,
    oceanic_gift: handleOceanicGift,
    divine_spark: handleDivineSpark,
    divine_intervention: handleDivineIntervention,
    font_of_magic: handleFontOfMagic,
    healing_pool: handleHealingPool,
    extra_action: handleExtraAction,
        combat_stance: handleCombatStance,
    stride_of_the_elements: handleStrideOfTheElements,
    elemental_epitome: handleElementalEpitome,
    destructive_stride: handleDestructiveStride,
    attack_rider: handleAttackRider,
    spell_modifier: (action) => (action.name === 'Metamagic' ? null : automationInfoPopup(action)),
    temp_hp_buff: handleTempHpBuff,
    auto_reroll: handleAutoReroll,
    reaction_damage: handleReactionDamage,
    reaction_debuff: handleReactionDebuff,
    reaction_spell: handleReactionSpell,
    interception: handleInterception,
    damage_reduction: (action, playerStats, campaignName, mapName) => {
        const auto = action.automation;
        if (auto?.cost?.resource === 'psionicEnergy') {
            return handleProtectiveField(action, playerStats, campaignName, mapName);
        }
        return handleDamageReduction(action, playerStats, campaignName, mapName);
    },
    arcane_ward: handleArcaneWard,
    projected_ward: handleArcaneWard,
    arcane_ward_bonus_action: handleArcaneWardBonusActionRestore,
    arcane_vigor: handleArcaneVigor,
     open_hand_technique: handleOpenHandTechnique,
     quivering_palm: handleQuiveringPalm,
    reaction_save_heal: handleReactionSaveHeal,
        mastery_rider: handleWeaponMastery,
        weapon_mastery_choice: handleWeaponMasteryChoice,
        weapon_kind_mastery: handleWeaponKindMastery,
    revivification: handleRevivification,
     bardic_inspiration: handleBardicInspiration,
       bardic_inspiration_use: handleBardicInspirationUse,
      heroic_inspiration_buff: handleEncouragingSong,
     reaction_bonus: handleReactionBonus,
      post_cast_rider: handlePostCastRider,
       bardic_inspiration_defense: handleBardicInspirationDefense,
      bardic_inspiration_offense: handleBardicInspirationOffense,
        countercharm: handleCountercharm,
        font_of_inspiration: handleFontOfInspiration,
        agile_strike: handleAgileStrike,
        multi_target_spread: handleMultiTarget,
        divine_order: handleDivineOrder,
        nature_sanctuary: handleNaturesSanctuary,
        nature_sanctuary_move: handleNaturesSanctuaryMove,
        starry_form: handleStarryForm,
        starry_form_arrow: handleStarryFormArrow,
        cosmic_omen: handleCosmicOmen,
        twinkling_constellations: handleTwinklingConstellation,
        tactical_mind: handleTacticalMind,
         combat_superiority: handleCombatSuperiority,
          combat_superiority_bonus_action: handleCombatSuperiorityBonusAction,
           combat_superiority_reaction: handleCombatSuperiorityReaction,
            combat_superiority_grant_attack: handleCombatSuperiorityGrantAttack,
            combat_superiority_movement: handleCombatSuperiorityMovement,
             combat_superiority_skill_check: handleCombatSuperioritySkillCheck,
              combat_superiority_commanding_presence_reaction: handleCombatSuperiorityCommandingPresenceReaction,
               combat_superiority_sweeping_attack: handleCombatSuperioritySweepingAttack,
               combat_superiority_attack_rider: handleAttackRiderPrompt,
               combat_superiority_prompt_skill_check: handleSkillCheckPrompt,
            know_enemy: handleKnowEnemy,
        war_bond_summon: handleWarBond,
        war_magic_cantrip: handleWarMagicCantrip,
        war_magic_spell: handleWarMagicSpell,
        arcane_charge: handleArcaneCharge,
        psionic_strike: handlePsionicStrike,
        protective_field: handleProtectiveField,
        telekinetic_movement: handleTelekineticMovement,
        telekinetic_leap: handleTelekineticLeap,
        telekinetic_thrust: handleTelekineticThrust,
        guarded_mind: handleGuardedMind,
        bulwark_of_force: handleBulwarkOfForce,
        concentration_bonus_attack: handleConcentrationBonusAttack,
        damage_type_modifier: handleDamageTypeModifier,
        superior_defense: handleSuperiorDefense,
        hand_of_ultimate_mercy: handleHandOfUltimateMercy,
        cloak_of_shadows: handleCloakOfShadows,
        sacred_weapon: handleSacredWeapon,
        post_cast_smite_cover: handleSmiteOfProtection,
        holy_nimbus: handleHolyNimbus,
        post_cast_inspiring_smite: handleInspiringSmite,
        peerless_athlete: handlePeerlessAthlete,
        glorious_defense: handleGloriousDefense,
        living_legend: handleLivingLegend,
        undying_sentinel: handleUndyingSentinel,
        elder_champion: handleElderChampion,
        vow_of_enmity: handleVowOfEnmity,
        relentless_avenger: handleRelentlessAvenger,
        relentless_endurance: handleRelentlessEndurance,
        soul_of_vengeance: handleSoulOfVengeance,
        avenging_angel: handleAvengingAngel,
        radiance_of_dawn: handleRadianceOfDawn,
        primal_companion_summon: handlePrimalCompanionSummon,
        primal_companion_summon_confirm: handlePrimalCompanionSummonConfirm,
        primal_companion_command: handlePrimalCompanionCommand,
        primal_companion_restore: handlePrimalCompanionRestore,
        primal_companion_bonus_action_command: handlePrimalCompanionBonusActionCommand,
        primal_companion_bonus_action_command_apply: applyPrimalCompanionBonusActionCommand,
        primal_companion_spell_share: handlePrimalCompanionSpellShare,
        primal_companion_spell_share_apply: applyPrimalCompanionSpellShare,
        reaction_save: handleBeguilingTwist,
        fey_reinforcements: handleFeyReinforcements,
        fey_reinforcements_confirm: handleFeyReinforcementsConfirm,
        misty_wanderer: handleMistyWanderer,
        misty_wanderer_confirm: handleMistyWandererConfirm,
        shadowy_dodge: handleShadowyDodge,
        misty_escape: handleMistyEscape,
        beguiling_defenses: handleBeguilingDefenses,
        bewitching_magic: handleBewitchingMagic,
        hunter_prey: handleHunterPrey,
        defensive_tactics: handleDefensiveTactics,
        damage_type_choice: handleElementalAffinity,
        superior_hunter_prey: handleSuperiorHunterPrey,
        superior_hunter_defense: handleSuperiorHunterDefense,
        dread_ambush_damage: handleDreadAmbushDamage,
        natures_veil: handleNaturesVeil,
        tireless: handleTireless,
        bonus_action_choice: handleBonusActionChoice,
        bonus_attacks: handleBonusAttacks,
        patient_defense: handlePatientDefense,
        step_of_the_wind: handleStepOfTheWind,
        steady_aim: handleSteadyAim,
        mage_hand_control: handleMageHandControl,
        spell_thief: handleSpellThief,
        psychic_teleportation: handlePsychicTeleportation,
        fast_hands: handleFastHands,
        stealth_attack: handleStealthAttack,
        use_magic_device: handleUseMagicDevice,
        revelation_in_flesh: handleRevelationInFlesh,
        warping_implosion: handleWarpingImplosion,
         restore_balance: handleRestoreBalance,
         bastion_of_law: handleBastionOfLaw,
         bastion_of_law_spend: handleBastionOfLawSpend,
         trance_of_order: handleTranceOfOrder,
          clockwork_cavalcade: handleClockworkCavalcade,
          elemental_affinity: handleElementalAffinity,
            dragon_wings: handleDragonWings,
            dragon_companion: handleDragonCompanion,
            dragon_companion_confirm: handleDragonCompanionConfirm,
            wild_magic_surge: handleWildMagicSurge,
            wild_magic_tamed: handleWildMagicTamed,
            feats_of_chaos: handleFeatsOfChaosAdvantage,
            wild_magic_tamed_selected: onWildMagicTamedSelected,
             wild_magic_double_roll_selected: onDoubleRollSelected,
              elemental_attunement: handleElementalAttunement,
              elemental_burst: handleElementalBurst,
              magical_cunning: handleMagicalCunning,
            contact_patron: handleContactPatron,
             steps_of_the_fey: handleStepsOfTheFey,
             celestial_resilience: handleCelestialResilience,
            searing_vengeance: handleSearingVengeance,
            dark_ones_luck: handleDarkOnesLuck,
            fiendish_resilience: handleFiendishResilience,
                hurl_through_hell: handleHurlThroughHell,
                clairvoyant_combatant: handleClairvoyantCombatant,
                psychic_spells: handlePsychicSpells,
                create_thrall_temp_hp: handleCreateThrallTempHp,
                spell_mastery: handleSpellMastery,
                signature_spells: handleSignatureSpells,
                portent: handlePortent,
                 expert_divination: handleExpertDivination,
                 third_eye: handleThirdEye,
                  soulstitch_spells: handleSoulstitchSpells,
                   overchannel: handleOverchannel,
                   phantasmal_creatures: handlePhantasmalCreatures,
                    phantasmal_creatures_confirm: handlePhantasmalCreaturesConfirm,
                     illusory_self: handleIllusorySelf,
                     illusory_reality: handleIllusoryReality,
                     illusory_reality_confirm: handleIllusoryRealityConfirm,
                    celestial_revelation: handleCelestialRevelation,
                    stonecunning: handleStonecunning,
                    elfish_lineage: handleElfisLineage,
                     gnomish_lineage: handleGnomishLineage,
                    large_form: handleLargeForm,
                    fiendish_legacy: handleFiendishLegacy,
    giant_ancestry: handleGiantAncestry,
    clouds_jaunt: handleCloudsJaunt,
    teleport: handleCloudsJaunt,
    fire_burn: handleFiresBurn,
                      frosts_chill: handleFrostsChill,
                      hills_tumble: handleHillsTumble,
                      stones_endurance: handleStonesEndurance,
                      storms_thunder: handleStormsThunder,
                       aid: handleAid,
        aura_of_purity: handleAuraOfPurity,
        holy_aura: handleHolyAura,
        aura_of_life: handleAuraOfLife,
        circle_of_power: handleCircleOfPower,
        aura_of_vitality: handleAuraOfVitality,
        blade_ward: handleBladeWard,
        shield: handleShield,
        shield_of_faith: handleShieldOfFaith,
        reaction_counterspell: handleCounterSpell,
        blindness_deafness: handleBlindnessDeafness,
        eyebite: handleEyebite,
        false_life: handleFalseLife,
        heroism: handleHeroism,
        fear: handleFear,
        feign_death: handleFeignDeath,
        sleep: handleSleep,
        sleep_shake: handleSleepShake,
        flesh_to_stone: handleFleshToStone,
        hold_monster: handleHoldMonster,
        banishment: handleBanishment,
        polymorph: handlePolymorph,
        animal_shapes: handleAnimalShapes,
        true_polymorph: handleTruePolymorph,
        shapechange: handleShapechange,
        maze: handleMaze,
        maze_escape: handleMazeEscape,
        remove_maze: removeMazeEffect,
        friends: handleFriends,
        foresight: handleForesight,
        charm_person: handleCharmPerson,
        charm_monster: handleCharmMonster,
        compulsion: handleCompulsion,
        crown_of_madness: handleCrownOfMadness,
        animal_friendship: handleAnimalFriendship,
        dominate_beast: handleDominate,
        dominate_monster: handleDominate,
        dominate_person: handleDominate,
        globe_of_invulnerability: handleGlobeOfInvulnerability,
        antimagic_field: handleAntimagicField,
        grease_area_save: handleGreaseAreaSave,
        web_area_save: handleWebAreaSave,
        sleet_storm_area_save: handleSleetStorm,
        enhance_ability: handleEnhanceAbility,
        greater_restoration: handleGreaterRestoration,
        lesser_restoration: handleLesserRestoration,
        remove_curse: handleRemoveCurse,
        longstrider: handleLongstrider,
        longstrider_apply: applyLongstriderEffect,
        spare_the_dying: handleSpareTheDying,
        spare_the_dying_apply: applySpareTheDyingEffect,
        mage_armor: handleMageArmor,
        mage_armor_apply: applyMageArmorEffect,
        heroes_feast: handleHeroesFeast,
        heroes_feast_apply: handleHeroesFeast,
        hypnotic_pattern: handleHypnoticPattern,
        hypnotic_pattern_shake: handleHypnoticPatternShake,
        hypnotic_pattern_shake_confirm: handleHypnoticPatternShakeConfirm,
        mass_suggestion: handleMassSuggestion,
        suggestion: handleSuggestion,
        command: handleCommand,
        calm_emotions: handleCalmEmotions,
        resilient_sphere: handleResilientSphere,
        freezing_sphere: handleFreezingSphere,
        power_word_stun: handlePowerWordStun,
        warding_bond: handleWardingBond,
        ottos_dance: handleOttoDance,
        stinking_cloud: handleStinkingCloud,
        sleet_storm: handleSleetStorm,
        faerie_fire: handleFaerieFire,
        forcecage: handleForcecage,
        forcecage_escape: handleForcecageEscape,
        confusion: handleConfusion,
        tashas_laughter: handleTashasLaughter,
        imprisonment: handleImprisonment,
        prismatic_spray: handlePrismaticSpray,
        pass_without_trace: handlePassWithoutTrace,
        protection_from_energy: handleProtectionFromEnergy,
        protection_from_evil_and_good: handleProtectionFromEvilAndGood,
        protection_from_poison: handleProtectionFromPoison,
        stone_skin: handleStoneSkin,
        resistance: handleResistance,
        boon_of_energy_resistance: handleBoonOfEnergyResistance,
        modify_d20_roll: handleBoonOfFate,
        ray_of_enfeeblement: handleRayOfEnfeeblement,
        compelled_duel: handleCompelledDuel,
        sanctuary: handleSanctuary,
        vicious_mockery: handleViciousMockery,
        silence: handleSilence,
        bane: handleBane,
        bless: handleBless,
        beacon_of_hope: handleBeaconOfHope,
        slow: handleSlow,
        haste: handleHaste,
        barkskin: handleBarkskin,
        invisibility: handleInvisibility,
        greater_invisibility: handleGreaterInvisibility,
        regenerate: handleRegenerate,
        animate_dead: handleAnimateDead,
        animate_dead_confirm: handleAnimateDeadConfirm,
        create_undead: handleCreateUndead,
        create_undead_confirm: handleCreateUndeadConfirm,
        summon_spirit: handleSummonSpirit,
        summon_spirit_confirm: handleSummonSpiritConfirm,
        survive_and_heal: handleBoonOfRecovery,
        lucky_point: handleLuckyPoint,
        telekinetic_shove: handleTelekineticShove,
        sentinel_guardian: handleSentinelGuardian,
        sentinel: handleSentinelHalt,
};
export {
    applyAidEffect, applyBaneEffect, applyBlessEffect, applyGreaterRestorationEffect, applyHeroesFeastEffect, applyLesserRestorationEffect,
    applyLongstriderEffect, applyMageArmorEffect, applyProtectionFromEvilAndGood, applyProtectionFromEnergyHandler, applyProtectionFromPoisonHandler,
    applyRemoveCurseEffect, applyBoonOfEnergyResistance, applyWeaponMasteryChoice, applyWeaponKindMastery, applyResistanceEffect,
    applyStoneSkinHandler, isProtectionFromEvilAndGoodActive, isCreatureWarded, isProtectionFromPoisonActive,
    applyDeathWardEffect, isDeathWardActive,
    isStoneSkinActive, getStoneSkinDamageTypes, isRayOfEnfeeblementActive, getResistanceDamageType,
    isCompelledDuelActive, checkCompelledDuelAttackExpiry, endCompelledDuel,
    isSanctuaryActive, endSanctuary, getSanctuaryTarget, handleSanctuary,
    isResistanceUsedThisTurn, applyShieldOfFaithEffect, isShieldOfFaithActive, getShieldOfFaithBonus,
    getWardingBondTarget, getWardingBondSource,     isWardingBondActive,
    applyHaste,
    isHasteActive,
    applyBarkskinEffect,
    isBarkskinActive,
    applyInvisibility,
    isInvisibilityActive,
    applyGreaterInvisibility,
    isGreaterInvisibilityActive,
    applyPassWithoutTraceEffect,
    applyRegenerateEffect,
    applyEnhanceAbilityEffect,
    applyFeignDeath,
    applyHeroism,
    isHeroismActive,
    applyBeaconOfHopeEffect,
    applyHolyAuraEffect,
    applySpareTheDyingEffect,
    applyAuraOfLifeEffect,
    isAuraOfLifeActive,
    applyAuraOfPurityEffect,
    isAuraOfPurityActive,
    applyCircleOfPowerEffect,
    isCircleOfPowerActive,
    applyAuraOfVitalityEffect,
    isAuraOfVitalityActive,
    applyCompulsionEffect,
    triggerCrownOfMadness,
};
export { confirmMassHeal } from './handlers/healing/massHealHandler.js';
export { confirmMassCureWounds } from './handlers/healing/massCureWoundsHandler.js';
export { confirmPrayerOfHealing } from './handlers/healing/prayerOfHealingHandler.js';
export { confirmMassHealingWord } from './handlers/healing/massHealingWordHandler.js';
export { confirmPowerWordFortify } from './handlers/buffs/powerWordFortifyHandler.js';
export { confirmSearingVengeance, skipSearingVengeance } from './handlers/class-warlock/searingVengeanceHandler.js';
export { confirmCelestialResilience, skipCelestialResilience } from './handlers/class-warlock/celestialResilienceHandler.js';
export { confirmAnimateDead } from './handlers/spells/animateDeadHandler.js';
export { confirmSummonSpirit } from './handlers/spells/summonSpiritHandler.js';
export async function executeHandler(action, playerStats, campaignName, mapName, characters) {
    if (!action?.automation) {
        return null;
    }

    let auto = action.automation;

    // Some features (e.g. Guarded Mind, Telekinetic Master) have an array of
    // automation entries (passive resistance + active uses). Collect every
    // actionable one: skip passive_rule entries without a runtime handler,
    // keep entries with a registered handler. An entry flagged
    // `replacesWarMagic` (e.g. Eldritch Knight lv18 Improved War Magic)
    // supersedes the earlier half of the same feature (the lv7 cantrip half),
    // so prefer it over the first actionable entry.
    if (Array.isArray(auto)) {
        const actionable = auto.filter(a => {
            if (!a) return false;
            if (a.type === 'passive_rule') return PASSIVE_RULE_EFFECTS[a.effect];
            return (a.casting_time || a.action || a.trigger) && HANDLER_MAP[a.type];
        });
        const selected = actionable.find(a => a.replacesWarMagic)
            // CLA-229: Misty Wanderer declares automation [free_spell, misty_wanderer].
            // The free_spell half's consumption path lives on the spell row
            // (spellPreparationService), so its automation[0] position must not
            // shadow the companion-carry half — the row dispatches the modal.
            || actionable.find(a => a.type === 'misty_wanderer')
            || actionable[0];
        if (!selected) {
            return null;
        }
        action = { ...action, automation: selected };
        auto = selected;
    }

    let handler;

    if (auto.type === 'passive_rule' && PASSIVE_RULE_EFFECTS[auto.effect]) {
        handler = PASSIVE_RULE_EFFECTS[auto.effect];
    } else if (auto.type === 'auto_effect' && auto.effect === 'wild_magic_surge_table') {
        handler = handleWildMagicSurge;
    } else if (auto.type === 'auto_effect' && auto.effect === 'wild_magic_double_roll') {
        // Controlled Chaos — just set the flag, no handler needed
        return null;
    } else if (auto.type === 'auto_effect' && auto.effect === 'psychic_teleportation') {
        // CLA-320: Soul Blades' Psychic Teleportation declares type 'auto_effect'
        // (no type-level handler) — route by effect to its registered handler so
        // the Bonus Actions row expends the Psionic Energy die and logs.
        handler = handlePsychicTeleportation;
    } else if (auto.type === 'save_attack' && auto.resourceCost === 'sorcery_points' && auto.restoreCost) {
        // CLA-384: Warping Implosion ships type 'save_attack' in classes.json, so
        // the generic save_attack handler always beat its dedicated warping_implosion
        // entry — route on the sorcery_points+restoreCost fingerprint (unique across
        // both ruleset data files) so the teleport chooser and 5 SP restore are live.
        handler = handleWarpingImplosion;
    } else {
        handler = HANDLER_MAP[auto.type];
    }

    if (!handler) {
        return null;
    }

    try {
        const result = await handler(action, playerStats, campaignName, mapName, characters);
        return result;
      } catch (e) {
          console.error(`[automation] Handler ${auto.type}/${auto.effect} failed:`, e);
          return { type: 'popup', payload: { type: 'automation_info', name: action.name, description: `Failed to execute ${action.name}` } };
      }
}
