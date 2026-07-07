import { useSyncedState } from '../../hooks/runtime/useSyncedState.js';
import useAttackDamageResolution from './useAttackDamageResolution.js';
import useModalHandlers from './useModalHandlers.js';
import { useCombatSuperiorityModal } from '../../hooks/combat/useCombatSuperiorityModal.js';

export default function useCharActionModals({
    playerStats, campaignName, mapName,
    popupHtml, setPopupHtml, rollDamage, rollAttack, buildCtx, buildCtxSync,
}) {
    const [healingPoolModal, setHealingPoolModal] = useSyncedState(campaignName, 'modal-healingPool', null);
    const [handOfHealingModal, setHandOfHealingModal] = useSyncedState(campaignName, 'modal-handOfHealing', null);
    const [fontOfMagicModal, setFontOfMagicModal] = useSyncedState(campaignName, 'modal-fontOfMagic', null);
    const [resourcePoolModal, setResourcePoolModal] = useSyncedState(campaignName, 'modal-resourcePool', null);
    const [wildCompanionModal, setWildCompanionModal] = useSyncedState(campaignName, 'modal-wildCompanion', null);
    const [setConditionModal, setSetConditionModal] = useSyncedState(campaignName, 'modal-setCondition', null);
    const [attackRiderModal, setAttackRiderModal] = useSyncedState(campaignName, 'modal-attackRider', null);
    const [openHandTechniqueModal, setOpenHandTechniqueModal] = useSyncedState(campaignName, 'modal-openHandTechnique', null);
    const [weaponMasteryModal, setWeaponMasteryModal] = useSyncedState(campaignName, 'modal-weaponMastery', null);
    const [weaponMasteryChoiceModal, setWeaponMasteryChoiceModal] = useSyncedState(campaignName, 'modal-weaponMasteryChoice', null);
    const [weaponKindMasteryModal, setWeaponKindMasteryModal] = useSyncedState(campaignName, 'modal-weaponKindMastery', null);
    const [combatStanceModal, setCombatStanceModal] = useSyncedState(campaignName, 'modal-combatStance', null);
    const [teleportModal, setTeleportModal] = useSyncedState(campaignName, 'modal-teleport', null);
    const [healingIllusionModal, setHealingIllusionModal] = useSyncedState(campaignName, 'modal-healingIllusion', null);
    const [saveAttackHealModal, setSaveAttackHealModal] = useSyncedState(campaignName, 'modal-saveAttackHeal', null);
    const [divineSparkModal, setDivineSparkModal] = useSyncedState(campaignName, 'modal-divineSpark', null);
    const [divineInterventionModal, setDivineInterventionModal] = useSyncedState(campaignName, 'modal-divineIntervention', null);
    const [divineInterventionAction, setDivineInterventionAction] = useSyncedState(campaignName, 'modal-divineInterventionAction', null);
    const [moonlightStepResourceModal, setMoonlightStepResourceModal] = useSyncedState(campaignName, 'modal-moonlightStepResource', null);
    const [starryFormConstellationModal, setStarryFormConstellationModal] = useSyncedState(campaignName, 'modal-starryFormConstellation', null);
    const [twinklingConstellationModal, setTwinklingConstellationModal] = useSyncedState(campaignName, 'modal-twinklingConstellation', null);
    const [arcaneChargeModal, setArcaneChargeModal] = useSyncedState(campaignName, 'modal-arcaneCharge', null);
    const [warMagicCantripModal, setWarMagicCantripModal] = useSyncedState(campaignName, 'modal-warMagicCantrip', null);
    const [warMagicSpellModal, setWarMagicSpellModal] = useSyncedState(campaignName, 'modal-warMagicSpell', null);
    const [sacredWeaponModal, setSacredWeaponModal] = useSyncedState(campaignName, 'modal-sacredWeapon', null);
    const [elderChampionRestoreModal, setElderChampionRestoreModal] = useSyncedState(campaignName, 'modal-elderChampionRestore', null);
    const [primalCompanionBonusActionModal, setPrimalCompanionBonusActionModal] = useSyncedState(campaignName, 'modal-primalCompanionBonusAction', null);
    const [mistyWandererModal, setMistyWandererModal] = useSyncedState(campaignName, 'modal-mistyWanderer', null);
    const [bonusActionChoiceModal, setBonusActionChoiceModal] = useSyncedState(campaignName, 'modal-bonusActionChoice', null);
    const [revelationInFleshModal, setRevelationInFleshModal] = useSyncedState(campaignName, 'modal-revelationInFlesh', null);
    const [bastionOfLawModal, setBastionOfLawModal] = useSyncedState(campaignName, 'modal-bastionOfLaw', null);
    const [elementalAffinityModal, setElementalAffinityModal] = useSyncedState(campaignName, 'modal-elementalAffinity', null);
    const [fiendishResilienceModal, setFiendishResilienceModal] = useSyncedState(campaignName, 'modal-fiendishResilience', null);
    const [boonOfEnergyResistanceModal, setBoonOfEnergyResistanceModal] = useSyncedState(campaignName, 'modal-boonOfEnergyResistance', null);
    const [dragonCompanionModal, setDragonCompanionModal] = useSyncedState(campaignName, 'modal-dragonCompanion', null);
    const [wildMagicDoubleRollModal, setWildMagicDoubleRollModal] = useSyncedState(campaignName, 'modal-wildMagicDoubleRoll', null);
    const [wildMagicTamedModal, setWildMagicTamedModal] = useSyncedState(campaignName, 'modal-wildMagicTamed', null);
    const [divinationSavantModal, setDivinationSavantModal] = useSyncedState(campaignName, 'modal-divinationSavant', null);
    const [illusionSavantModal, setIllusionSavantModal] = useSyncedState(campaignName, 'modal-illusionSavant', null);
    const [thirdEyeModal, setThirdEyeModal] = useSyncedState(campaignName, 'modal-thirdEye', null);
    const [soulstitchSpellsModal, setSoulstitchSpellsModal] = useSyncedState(campaignName, 'modal-soulstitchSpells', null);
    const [illusoryRealityModal, setIllusoryRealityModal] = useSyncedState(campaignName, 'modal-illusoryReality', null);
    const [celestialRevelationModal, setCelestialRevelationModal] = useSyncedState(campaignName, 'modal-celestialRevelation', null);
    const [elfishLineageModal, setElfisLineageModal] = useSyncedState(campaignName, 'modal-elfishLineage', null);
    const [gnomishLineageModal, setGnomishLineageModal] = useSyncedState(campaignName, 'modal-gnomishLineage', null);
    const [fiendishLegacyModal, setFiendishLegacyModal] = useSyncedState(campaignName, 'modal-fiendishLegacy', null);
    const [giantAncestryModal, setGiantAncestryModal] = useSyncedState(campaignName, 'modal-giantAncestry', null);
    const [hypnoticPatternShakeModal, setHypnoticPatternShakeModal] = useSyncedState(campaignName, 'modal-hypnoticPatternShake', null);
    const [arcaneWardRestoreModal, setArcaneWardRestoreModal] = useSyncedState(campaignName, 'modal-arcaneWardRestore', null);
    const [eyebiteEffectModal, setEyebiteEffectModal] = useSyncedState(campaignName, 'modal-eyebiteEffect', null);
    const [divineFuryChoice, setDivineFuryChoice] = useSyncedState(campaignName, 'modal-divineFuryChoice', null);
    const [damageTypeChoice, setDamageTypeChoice] = useSyncedState(campaignName, 'modal-damageTypeChoice', null);
    const [featureChoice, setFeatureChoice] = useSyncedState(campaignName, 'modal-featureChoice', null);
    const [attackRiderManeuverPrompt, setAttackRiderManeuverPrompt] = useSyncedState(campaignName, 'modal-attackRiderManeuverPrompt', null);
    const [sweepingAttackTargetModal, setSweepingAttackTargetModal] = useSyncedState(campaignName, 'modal-sweepingAttackTarget', null);
    const [baitAndSwitchChoiceModal, setBaitAndSwitchChoiceModal] = useSyncedState(campaignName, 'modal-baitAndSwitchChoice', null);
    const [commanderStrikeChoiceModal, setCommanderStrikeChoiceModal] = useSyncedState(campaignName, 'modal-commanderStrikeChoice', null);
    const [rallyChoiceModal, setRallyChoiceModal] = useSyncedState(campaignName, 'modal-rallyChoice', null);
    const [bulwarkOfForceModal, setBulwarkOfForceModal] = useSyncedState(campaignName, 'modal-bulwarkOfForce', null);
    const [coronaEnemySelectionModal, setCoronaEnemySelectionModal] = useSyncedState(campaignName, 'modal-coronaEnemySelection', null);
    const [radianceOfDawnModal, setRadianceOfDawnModal] = useSyncedState(campaignName, 'modal-radianceOfDawn', null);
    const [tricksterBlessingModal, setTricksterBlessingModal] = useSyncedState(campaignName, 'modal-tricksterBlessing', null);
    const [bardicInspirationTargetModal, setBardicInspirationTargetModal] = useSyncedState(campaignName, 'modal-bardicInspirationTarget', null);
    const [inspiringMovementAllyModal, setInspiringMovementAllyModal] = useSyncedState(campaignName, 'modal-inspiringMovementAlly', null);
    const [secondaryTargetModal, setSecondaryTargetModal] = useSyncedState(campaignName, 'modal-secondaryTarget', null);
    const [invokeDuplicityModal, setInvokeDuplicityModal] = useSyncedState(campaignName, 'modal-invokeDuplicity', null);
    const [stealthAttackModal, setStealthAttackModal] = useSyncedState(campaignName, 'modal-stealthAttack', null);
    const [mantleOfInspirationTarget, setMantleOfInspirationTarget] = useSyncedState(campaignName, 'modal-mantleOfInspirationTarget', null);

    const [pendingDamage, setPendingDamage] = useSyncedState(campaignName, 'pipeline-pause', null);

    const { resolveAttackDamage, proceedWithDamage } = useAttackDamageResolution({
        playerStats, campaignName, mapName,
        popupHtml, setPopupHtml, rollDamage, buildCtx, buildCtxSync,
        setDamageTypeChoice, setDivineFuryChoice, setWeaponMasteryModal, setAttackRiderModal,
        setAttackRiderManeuverPrompt,
        setSweepingAttackTargetModal,
        setSecondaryTargetModal,
    });

    const {
        combatSuperiorityModal,
        setCombatSuperiorityModal,
        handleCombatSuperiorityConfirm,
        handleCombatSuperiorityReopenSelection,
    } = useCombatSuperiorityModal(playerStats, campaignName, rollAttack, rollDamage, setPopupHtml);

    const {
        handleMasteryClose,
        handleWeaponMasteryChoice,
        handleDivineFuryDamageType,
        handleDivineFurySkip,
        handleGenericDamageTypeChoice,
        handleGenericDamageTypeSkip,
        handleDamageTypeModifierChoice,
        handleDamageTypeModifierSkip,
        handleEnhancedUnarmedChoice,
        handleEnhancedUnarmedSkip,
        handleFeatureChoiceConfirm,
        handleFeatureChoiceSkip,
        handleConstellationSelect,
        handleElderChampionRestore,
    } = useModalHandlers({
        playerStats, campaignName,
        rollDamage, proceedWithDamage,
        pendingDamage, setPendingDamage,
        featureChoice,
        setDamageTypeChoice, setDivineFuryChoice,
        setWeaponMasteryModal, setWeaponMasteryChoiceModal,
        setFeatureChoice,
        setStarryFormConstellationModal, setTwinklingConstellationModal,
        setPopupHtml,
    });

    return {
        pendingDamage,
        setPendingDamage,
        buildCtx,
        buildCtxSync,
        healingPoolModal, setHealingPoolModal,
        handOfHealingModal, setHandOfHealingModal,
        fontOfMagicModal, setFontOfMagicModal,
        resourcePoolModal, setResourcePoolModal,
        wildCompanionModal, setWildCompanionModal,
        setConditionModal, setSetConditionModal,
        attackRiderModal, setAttackRiderModal,
        openHandTechniqueModal, setOpenHandTechniqueModal,
        weaponMasteryModal, setWeaponMasteryModal,
        weaponMasteryChoiceModal, setWeaponMasteryChoiceModal,
        weaponKindMasteryModal, setWeaponKindMasteryModal,
        combatStanceModal, setCombatStanceModal,
        teleportModal, setTeleportModal,
        healingIllusionModal, setHealingIllusionModal,
        saveAttackHealModal, setSaveAttackHealModal,
        divineSparkModal, setDivineSparkModal,
        divineInterventionModal, setDivineInterventionModal,
        divineInterventionAction, setDivineInterventionAction,
        moonlightStepResourceModal, setMoonlightStepResourceModal,
        starryFormConstellationModal, setStarryFormConstellationModal,
        twinklingConstellationModal, setTwinklingConstellationModal,
        arcaneChargeModal, setArcaneChargeModal,
        warMagicCantripModal, setWarMagicCantripModal,
        warMagicSpellModal, setWarMagicSpellModal,
        sacredWeaponModal, setSacredWeaponModal,
        elderChampionRestoreModal, setElderChampionRestoreModal,
        primalCompanionBonusActionModal, setPrimalCompanionBonusActionModal,
        mistyWandererModal, setMistyWandererModal,
        bonusActionChoiceModal, setBonusActionChoiceModal,
        revelationInFleshModal, setRevelationInFleshModal,
        bastionOfLawModal, setBastionOfLawModal,
        elementalAffinityModal, setElementalAffinityModal,
        fiendishResilienceModal, setFiendishResilienceModal,
        boonOfEnergyResistanceModal, setBoonOfEnergyResistanceModal,
        dragonCompanionModal, setDragonCompanionModal,
        wildMagicDoubleRollModal, setWildMagicDoubleRollModal,
        wildMagicTamedModal, setWildMagicTamedModal,
        divinationSavantModal, setDivinationSavantModal,
        illusionSavantModal, setIllusionSavantModal,
        thirdEyeModal, setThirdEyeModal,
        soulstitchSpellsModal, setSoulstitchSpellsModal,
        illusoryRealityModal, setIllusoryRealityModal,
        celestialRevelationModal, setCelestialRevelationModal,
        elfishLineageModal, setElfisLineageModal,
        gnomishLineageModal, setGnomishLineageModal,
        fiendishLegacyModal, setFiendishLegacyModal,
        giantAncestryModal, setGiantAncestryModal,
        hypnoticPatternShakeModal, setHypnoticPatternShakeModal,
        arcaneWardRestoreModal, setArcaneWardRestoreModal,
        combatSuperiorityModal, setCombatSuperiorityModal,
        handleCombatSuperiorityConfirm,
        handleCombatSuperiorityReopenSelection,
        eyebiteEffectModal, setEyebiteEffectModal,
        divineFuryChoice, setDivineFuryChoice,
        damageTypeChoice, setDamageTypeChoice,
        featureChoice, setFeatureChoice,
        attackRiderManeuverPrompt, setAttackRiderManeuverPrompt,
        sweepingAttackTargetModal, setSweepingAttackTargetModal,
        baitAndSwitchChoiceModal, setBaitAndSwitchChoiceModal,
        commanderStrikeChoiceModal, setCommanderStrikeChoiceModal,
        rallyChoiceModal, setRallyChoiceModal,
        bulwarkOfForceModal, setBulwarkOfForceModal,
        coronaEnemySelectionModal, setCoronaEnemySelectionModal,
        radianceOfDawnModal, setRadianceOfDawnModal,
        tricksterBlessingModal, setTricksterBlessingModal,
        bardicInspirationTargetModal, setBardicInspirationTargetModal,
        inspiringMovementAllyModal, setInspiringMovementAllyModal,
        secondaryTargetModal, setSecondaryTargetModal,
        invokeDuplicityModal, setInvokeDuplicityModal,
        stealthAttackModal, setStealthAttackModal,
        mantleOfInspirationTarget, setMantleOfInspirationTarget,
        resolveAttackDamage,
        handleMasteryClose,
        handleWeaponMasteryChoice,
        handleDivineFuryDamageType,
        handleDivineFurySkip,
        handleGenericDamageTypeChoice,
        handleGenericDamageTypeSkip,
        handleDamageTypeModifierChoice,
        handleDamageTypeModifierSkip,
        handleEnhancedUnarmedChoice,
        handleEnhancedUnarmedSkip,
        handleFeatureChoiceConfirm,
        handleFeatureChoiceSkip,
        handleConstellationSelect,
        handleElderChampionRestore,
    };
}
