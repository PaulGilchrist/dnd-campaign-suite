import { useState, useRef } from 'react'
import useAttackDamageResolution from './useAttackDamageResolution.js';
import useModalHandlers from './useModalHandlers.js';
import { useCombatSuperiorityModal } from '../../hooks/combat/useCombatSuperiorityModal.js';

export default function useCharActionModals({
    playerStats, campaignName, mapName,
    popupHtml, setPopupHtml, rollDamage, rollAttack, buildCtx, buildCtxSync,
}) {
    const [healingPoolModal, setHealingPoolModal] = useState(null);
    const [handOfHealingModal, setHandOfHealingModal] = useState(null);
    const [fontOfMagicModal, setFontOfMagicModal] = useState(null);
    const [resourcePoolModal, setResourcePoolModal] = useState(null);
    const [wildCompanionModal, setWildCompanionModal] = useState(null);
    const [setConditionModal, setSetConditionModal] = useState(null);
    const [attackRiderModal, setAttackRiderModal] = useState(null);
    const [openHandTechniqueModal, setOpenHandTechniqueModal] = useState(null);
    const [weaponMasteryModal, setWeaponMasteryModal] = useState(null);
    const [weaponMasteryChoiceModal, setWeaponMasteryChoiceModal] = useState(null);
    const [weaponKindMasteryModal, setWeaponKindMasteryModal] = useState(null);
    const [combatStanceModal, setCombatStanceModal] = useState(null);
    const [teleportModal, setTeleportModal] = useState(null);
    const [healingIllusionModal, setHealingIllusionModal] = useState(null);
    const [saveAttackHealModal, setSaveAttackHealModal] = useState(null);
    const [divineSparkModal, setDivineSparkModal] = useState(null);
    const [divineInterventionModal, setDivineInterventionModal] = useState(null);
    const [divineInterventionAction, setDivineInterventionAction] = useState(null);
    const [moonlightStepResourceModal, setMoonlightStepResourceModal] = useState(null);
    const [starryFormConstellationModal, setStarryFormConstellationModal] = useState(null);
    const [twinklingConstellationModal, setTwinklingConstellationModal] = useState(null);
    const [arcaneChargeModal, setArcaneChargeModal] = useState(null);
    const [warMagicCantripModal, setWarMagicCantripModal] = useState(null);
    const [warMagicSpellModal, setWarMagicSpellModal] = useState(null);
    const [sacredWeaponModal, setSacredWeaponModal] = useState(null);
    const [elderChampionRestoreModal, setElderChampionRestoreModal] = useState(null);
    const [primalCompanionBonusActionModal, setPrimalCompanionBonusActionModal] = useState(null);
    const [mistyWandererModal, setMistyWandererModal] = useState(null);
    const [bonusActionChoiceModal, setBonusActionChoiceModal] = useState(null);
    const [revelationInFleshModal, setRevelationInFleshModal] = useState(null);
    const [bastionOfLawModal, setBastionOfLawModal] = useState(null);
    const [elementalAffinityModal, setElementalAffinityModal] = useState(null);
    const [fiendishResilienceModal, setFiendishResilienceModal] = useState(null);
    const [boonOfEnergyResistanceModal, setBoonOfEnergyResistanceModal] = useState(null);
    const [dragonCompanionModal, setDragonCompanionModal] = useState(null);
    const [wildMagicDoubleRollModal, setWildMagicDoubleRollModal] = useState(null);
    const [wildMagicTamedModal, setWildMagicTamedModal] = useState(null);
    const [divinationSavantModal, setDivinationSavantModal] = useState(null);
    const [illusionSavantModal, setIllusionSavantModal] = useState(null);
    const [thirdEyeModal, setThirdEyeModal] = useState(null);
    const [soulstitchSpellsModal, setSoulstitchSpellsModal] = useState(null);
    const [illusoryRealityModal, setIllusoryRealityModal] = useState(null);
    const [celestialRevelationModal, setCelestialRevelationModal] = useState(null);
    const [elfishLineageModal, setElfisLineageModal] = useState(null);
    const [gnomishLineageModal, setGnomishLineageModal] = useState(null);
    const [fiendishLegacyModal, setFiendishLegacyModal] = useState(null);
    const [giantAncestryModal, setGiantAncestryModal] = useState(null);
    const [hypnoticPatternShakeModal, setHypnoticPatternShakeModal] = useState(null);
    const [arcaneWardRestoreModal, setArcaneWardRestoreModal] = useState(null);
    const [eyebiteEffectModal, setEyebiteEffectModal] = useState(null);
    const [divineFuryChoice, setDivineFuryChoice] = useState(null);
    const [damageTypeChoice, setDamageTypeChoice] = useState(null);
    const [featureChoice, setFeatureChoice] = useState(null);
    const [attackRiderManeuverPrompt, setAttackRiderManeuverPrompt] = useState(null);
    const [sweepingAttackTargetModal, setSweepingAttackTargetModal] = useState(null);
    const [baitAndSwitchChoiceModal, setBaitAndSwitchChoiceModal] = useState(null);
    const [commanderStrikeChoiceModal, setCommanderStrikeChoiceModal] = useState(null);
    const [rallyChoiceModal, setRallyChoiceModal] = useState(null);
    const [bulwarkOfForceModal, setBulwarkOfForceModal] = useState(null);
    const [coronaEnemySelectionModal, setCoronaEnemySelectionModal] = useState(null);
    const [radianceOfDawnModal, setRadianceOfDawnModal] = useState(null);
    const [tricksterBlessingModal, setTricksterBlessingModal] = useState(null);
    const [bardicInspirationTargetModal, setBardicInspirationTargetModal] = useState(null);
    const [inspiringMovementAllyModal, setInspiringMovementAllyModal] = useState(null);
    const [secondaryTargetModal, setSecondaryTargetModal] = useState(null);
    const [invokeDuplicityModal, setInvokeDuplicityModal] = useState(null);
    const [stealthAttackModal, setStealthAttackModal] = useState(null);

    const pendingDamageRef = useRef(null);

    const { resolveAttackDamage, proceedWithDamage } = useAttackDamageResolution({
        playerStats, campaignName, mapName,
        popupHtml, setPopupHtml, rollDamage, buildCtx, buildCtxSync,
        setDamageTypeChoice, setDivineFuryChoice, setWeaponMasteryModal, setAttackRiderModal,
        setAttackRiderManeuverPrompt,
        setSweepingAttackTargetModal,
        pendingDamageRef,
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
        pendingDamageRef,
        featureChoice,
        setDamageTypeChoice, setDivineFuryChoice,
        setWeaponMasteryModal, setWeaponMasteryChoiceModal,
        setFeatureChoice,
        setStarryFormConstellationModal, setTwinklingConstellationModal,
        setPopupHtml,
    });

    return {
        pendingDamageRef,
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
