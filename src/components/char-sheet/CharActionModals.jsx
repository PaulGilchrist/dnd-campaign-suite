import { useState, useEffect } from 'react';
import HealingPoolModal from './modals/divine/HealingPoolModal.jsx'
import HandOfHealingModal from './modals/shared/HandOfHealingModal.jsx'
import FontOfMagicModal from './modals/FontOfMagicModal.jsx'
import ResourcePoolModal from './modals/ResourcePoolModal.jsx'
import WildCompanionModal from './modals/WildCompanionModal.jsx'
import SetConditionModal from './modals/shared/SetConditionModal.jsx'
import EyebiteEffectModal from './modals/EyebiteEffectModal.jsx'
import AttackRiderModal from './modals/shared/AttackRiderModal.jsx'
import OpenHandTechniqueModal from './modals/OpenHandTechniqueModal.jsx'
import WeaponMasteryModal from './modals/WeaponMasteryModal.jsx'
import WeaponMasteryChoiceModal from './modals/WeaponMasteryChoiceModal.jsx'
import WeaponKindMasteryModal from './modals/WeaponKindMasteryModal.jsx'
import BastionOfLawModal from './modals/divine/BastionOfLawModal.jsx'
import CombatStanceModal from './modals/shared/CombatStanceModal.jsx'
import TeleportModal from './modals/TeleportModal.jsx'
import SaveAttackHealModal from './modals/shared/SaveAttackHealModal.jsx'
import DivineSparkModal from './modals/divine/DivineSparkModal.jsx'
import DivineInterventionModal from './modals/divine/DivineInterventionModal.jsx'
import ArcaneChargeModal from './modals/arcane/ArcaneChargeModal.jsx'
import WarMagicCantripModal from './modals/WarMagicCantripModal.jsx'
import WarMagicSpellModal from './modals/WarMagicSpellModal.jsx'
import SacredWeaponModal from './modals/divine/SacredWeaponModal.jsx'
import ElderChampionRestoreModal from './modals/ElderChampionRestoreModal.jsx'
import PrimalCompanionBonusActionModal from './modals/PrimalCompanionBonusActionModal.jsx'
import MistyWandererModal from './modals/MistyWandererModal.jsx'
import BonusActionChoiceModal from './modals/shared/BonusActionChoiceModal.jsx'
import RevelationInFleshModal from './modals/RevelationInFleshModal.jsx'
import ElementalAffinityModal from './modals/ElementalAffinityModal.jsx'
import FiendishResilienceModal from './modals/FiendishResilienceModal.jsx'
import DragonCompanionModal from './modals/DragonCompanionModal.jsx'
import WildMagicDoubleRollModal from './modals/WildMagicDoubleRollModal.jsx'
import WildMagicTamedModal from './modals/WildMagicTamedModal.jsx'
import ThirdEyeModal from './modals/arcane/ThirdEyeModal.jsx'
import SoulstitchSpellsModal from './modals/arcane/SoulstitchSpellsModal.jsx'
import IllusoryRealityModal from './modals/arcane/IllusoryRealityModal.jsx'
import CelestialRevelationModal from './modals/CelestialRevelationModal.jsx'
import FiendishLegacyModal from './modals/FiendishLegacyModal.jsx'
import BreathWeaponShapeModal from './modals/racial/BreathWeaponShapeModal.jsx'
import HypnoticPatternShakeModal from './modals/shared/HypnoticPatternShakeModal.jsx'
import ArcaneWardRestoreModal from './modals/arcane/ArcaneWardRestoreModal.jsx'
import MoonlightStepResourceModal from './modals/MoonlightStepResourceModal.jsx'
import ConstellationSelectionModal from './modals/ConstellationSelectionModal.jsx'
import CombatSuperiorityModal from './modals/CombatSuperiorityModal.jsx'
import AttackRiderManeuverPrompt from './modals/AttackRiderManeuverPrompt.jsx'
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx'
import CreatureSelectionModal from './modals/shared/CreatureSelectionModal.jsx'
import BulwarkOfForceModal from './modals/BulwarkOfForceModal.jsx'
import CoronaEnemySelectionModal from './modals/CoronaEnemySelectionModal.jsx'
import RadianceOfDawnModal from './modals/RadianceOfDawnModal.jsx'
import { handleClearWard, handleSpendDice, handleApply } from '../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js'
import { getCombatContext } from '../../services/rules/combat/damageUtils.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { logHealingToSSE } from '../../services/automation/common/healingRoll.js'
import { addEntry } from '../../services/ui/logService.js'

function buildHealingIllusionTargets(playerStats, characters, combatSummary) {
    const allCreatures = [...(characters || []), ...(combatSummary?.creatures || [])];
    const names = new Set(allCreatures.map(c => c.name));
    const result = Array.from(names)
        .filter(name => name !== playerStats.name)
        .map(name => {
            const creature = allCreatures.find(c => c.name === name);
            return { name: creature.name, type: creature.type, size: creature.size, currentHp: creature.currentHp, maxHp: creature.maxHp };
        });
    console.log('[HealingIllusion] characters:', (characters || []).map(c => c.name));
    console.log('[HealingIllusion] combatSummary.creatures:', (combatSummary?.creatures || []).map(c => c.name));
    console.log('[HealingIllusion] final targets:', result.map(c => c.name));
    return result;
}

async function handleHealingIllusionConfirm(targetName, payload, characters, campaignName, onClose) {
    const { action, playerStats } = payload;
    const casterName = playerStats.name;
    console.log('[HealingIllusion] Confirm heal:', { targetName, caster: casterName });
    const stored = getRuntimeValue(casterName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = activeBuffs.filter(b => b.name !== action.name);
    setRuntimeValue(casterName, 'activeBuffs', newBuffs, campaignName);
    const healAmount = playerStats.level || 1;
    const maxHp = targetName === playerStats.name
        ? playerStats.hitPoints
        : (Number(getRuntimeValue(targetName, 'hitPoints', campaignName)) || 0);
    const currentHp = Number(getRuntimeValue(targetName, 'currentHitPoints', campaignName)) || 0;
    console.log('[HealingIllusion] HP before heal:', { targetName, currentHp, maxHp, healAmount });
    const newHp = Math.min(maxHp, currentHp + healAmount);
    await setRuntimeValue(targetName, 'currentHitPoints', newHp, campaignName);
    console.log('[HealingIllusion] HP after heal:', { targetName, newHp });
    logHealingToSSE(campaignName, {
        targetName,
        sourceName: action.name,
        actualHeal: newHp - currentHp,
        newHp,
        maxHp,
        healingName: 'Healing Illusion',
    });
    onClose();
}

function buildInvokeDuplicityTargets(playerStats, characters, combatSummary) {
    const allCreatures = [...(characters || []), ...(combatSummary?.creatures || [])];
    const names = new Set(allCreatures.map(c => c.name));
    const result = Array.from(names)
        .filter(name => name !== playerStats.name)
        .map(name => {
            const creature = allCreatures.find(c => c.name === name);
            return { name: creature.name, type: creature.type, currentHp: creature.currentHp, maxHp: creature.maxHp };
        });
    console.log('[InvokeDuplicity] characters:', (characters || []).map(c => c.name));
    console.log('[InvokeDuplicity] combatSummary.creatures:', (combatSummary?.creatures || []).map(c => c.name));
    console.log('[InvokeDuplicity] final targets:', result.map(c => c.name));
    return result;
}

async function handleInvokeDuplicityConfirm(selectedAllyNames, payload, campaignName, onClose) {
    const { playerStats } = payload;
    console.log('[ImprovedDuplicity] Modal confirm:', { selectedAllyNames, caster: playerStats.name });
    if (selectedAllyNames.length === 0) {
        console.log('[ImprovedDuplicity] No allies selected, skipping');
        onClose();
        return;
    }
    await setRuntimeValue(playerStats.name, 'invokeDuplicityAdvantageTargets', selectedAllyNames, campaignName);
    console.log('[ImprovedDuplicity] Stored advantage targets:', selectedAllyNames);
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Improved Duplicity',
        description: `${playerStats.name} used Improved Duplicity, granting Advantage to ${selectedAllyNames.join(', ')}.`,
    }).catch(() => {});
    window.dispatchEvent(new CustomEvent('buffs-updated'));
    onClose();
}

export default function CharActionModals({
    playerStats,
    campaignName,
    characters,
    healingPoolModal, setHealingPoolModal,
    handOfHealingModal, setHandOfHealingModal,
    fontOfMagicModal, setFontOfMagicModal,
    resourcePoolModal, setResourcePoolModal,
    wildCompanionModal, setWildCompanionModal,
    setConditionModal, setSetConditionModal,
    attackRiderModal, setAttackRiderModal,
    openHandTechniqueModal, setOpenHandTechniqueModal,
    weaponMasteryModal,
    weaponMasteryChoiceModal, setWeaponMasteryChoiceModal,
    weaponKindMasteryModal,
    combatStanceModal, setCombatStanceModal,
    teleportModal, setTeleportModal,
    healingIllusionModal, setHealingIllusionModal,
    invokeDuplicityModal, setInvokeDuplicityModal,
    saveAttackHealModal, setSaveAttackHealModal,
    divineSparkModal, setDivineSparkModal,
    divineInterventionModal, setDivineInterventionModal,
    setDivineInterventionAction,
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
    dragonCompanionModal, setDragonCompanionModal,
    wildMagicDoubleRollModal, setWildMagicDoubleRollModal,
    wildMagicTamedModal, setWildMagicTamedModal,
    thirdEyeModal, setThirdEyeModal,
    soulstitchSpellsModal, setSoulstitchSpellsModal,
    illusoryRealityModal, setIllusoryRealityModal,
    celestialRevelationModal, setCelestialRevelationModal,
    fiendishLegacyModal, setFiendishLegacyModal,
    eyebiteEffectModal, setEyebiteEffectModal,
    breathWeaponShapeModal, setBreathWeaponShapeModal,
    hypnoticPatternShakeModal, setHypnoticPatternShakeModal,
    arcaneWardRestoreModal, setArcaneWardRestoreModal,
    combatSuperiorityModal, setCombatSuperiorityModal,
    attackRiderManeuverPrompt,
    sweepingAttackTargetModal, setSweepingAttackTargetModal,
    divineFuryChoice,
    damageTypeChoice,
    featureChoice,
    handleMasteryClose,
    handleWeaponMasteryChoice,
    handleWeaponKindMasteryClose,
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
    handleCombatSuperiorityConfirm,
    handleAttackRiderManeuverUse,
    handleAttackRiderManeuverSkip,
    handleSweepingAttackConfirm,
    baitAndSwitchChoiceModal, setBaitAndSwitchChoiceModal,
    handleBaitAndSwitchChoiceConfirm,
    commanderStrikeChoiceModal, setCommanderStrikeChoiceModal,
    handleCommanderStrikeChoiceConfirm,
    rallyChoiceModal, setRallyChoiceModal,
    handleRallyChoiceConfirm,
    bulwarkOfForceModal, setBulwarkOfForceModal,
    handleBulwarkOfForceConfirm,
    coronaEnemySelectionModal, setCoronaEnemySelectionModal,
    handleCoronaEnemySelectionConfirm,
    radianceOfDawnModal, setRadianceOfDawnModal,
    handleRadianceOfDawnConfirm,
    tricksterBlessingModal,
    handleTricksterBlessingConfirm,
    handleDivineInterventionCast,
    pendingDamageRef,
}) {
    const [combatSummary, setCombatSummary] = useState(null);

    useEffect(() => {
        getCombatContext(campaignName).then(cs => {
            if (cs) setCombatSummary(cs);
        });
    }, [campaignName]);

    return (
        <>
            {healingPoolModal && (
                <HealingPoolModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    name={healingPoolModal.name}
                    poolMax={healingPoolModal.pool}
                    poolExpression={healingPoolModal.poolExpression}
                    isDicePool={healingPoolModal.isDicePool}
                    dieType={healingPoolModal.dieType}
                    resourceKey={healingPoolModal.resourceKey}
                    alsoCures={healingPoolModal.alsoCures}
                    cureCost={healingPoolModal.cureCost}
                    bloodiedOnly={healingPoolModal.bloodiedOnly}
                    restoringTouchConditions={healingPoolModal.restoringTouchConditions}
                    maxDicePerUse={healingPoolModal.maxDicePerUse}
                    onClose={() => setHealingPoolModal(null)}
                />
            )}
            {handOfHealingModal && (
                <HandOfHealingModal
                    {...handOfHealingModal}
                    campaignName={campaignName}
                    onClose={() => setHandOfHealingModal(null)}
                />
            )}
            {fontOfMagicModal && (
                <FontOfMagicModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setFontOfMagicModal(null)}
                />
            )}
            {resourcePoolModal && (
                <ResourcePoolModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    automation={resourcePoolModal.automation}
                    onClose={() => setResourcePoolModal(null)}
                />
            )}
            {moonlightStepResourceModal && (
                <MoonlightStepResourceModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    automation={moonlightStepResourceModal.automation}
                    onClose={() => setMoonlightStepResourceModal(null)}
                />
            )}
            {wildCompanionModal && (
                <WildCompanionModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setWildCompanionModal(null)}
                />
            )}
            {setConditionModal && (
                <SetConditionModal
                    {...setConditionModal}
                    characters={characters}
                    onClose={() => setSetConditionModal(null)}
                />
            )}
            {eyebiteEffectModal && (
                <EyebiteEffectModal
                    {...eyebiteEffectModal}
                    characters={characters}
                    onClose={() => setEyebiteEffectModal(null)}
                />
            )}
            {attackRiderModal && (
                <AttackRiderModal
                    {...attackRiderModal}
                    onClose={() => { setAttackRiderModal(null); window.dispatchEvent(new CustomEvent('target-effects-updated')); }}
                />
            )}
            {openHandTechniqueModal && (
                <OpenHandTechniqueModal
                    {...openHandTechniqueModal}
                    onClose={() => { setOpenHandTechniqueModal(null); window.dispatchEvent(new CustomEvent('target-effects-updated')); window.dispatchEvent(new CustomEvent('combat-summary-updated')); }}
                />
            )}
            {weaponMasteryModal && (
                <WeaponMasteryModal
                    {...weaponMasteryModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    targetName={null}
                    onClose={handleMasteryClose}
                />
            )}
            {weaponMasteryChoiceModal && (
                <WeaponMasteryChoiceModal
                    {...weaponMasteryChoiceModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => { setWeaponMasteryChoiceModal(null); }}
                    onConfirm={handleWeaponMasteryChoice}
                />
            )}
            {weaponKindMasteryModal && (
                <WeaponKindMasteryModal
                    {...weaponKindMasteryModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={handleWeaponKindMasteryClose}
                />
            )}
            {combatStanceModal && (
                <CombatStanceModal
                    {...combatStanceModal}
                    onClose={() => { setCombatStanceModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {revelationInFleshModal && (
                <RevelationInFleshModal
                    {...revelationInFleshModal}
                    onClose={() => { setRevelationInFleshModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {bastionOfLawModal && (
                <BastionOfLawModal
                    {...bastionOfLawModal}
                    campaignName={campaignName}
                    onConfirm={async (spAmount, targetName, diceToSpend, clearWard) => {
                        if (clearWard) {
                            const action = { name: bastionOfLawModal.featureName, automation: bastionOfLawModal.auto };
                            return await handleClearWard(action, playerStats, campaignName);
                        }
                        if (diceToSpend !== undefined && diceToSpend !== null) {
                            const action = { name: bastionOfLawModal.featureName, automation: bastionOfLawModal.auto };
                            return await handleSpendDice(action, playerStats, campaignName, diceToSpend);
                        }
                        const action = { name: bastionOfLawModal.featureName, automation: bastionOfLawModal.auto };
                        return await handleApply(action, playerStats, campaignName, spAmount, targetName);
                    }}
                    onClose={() => setBastionOfLawModal(null)}
                />
            )}
            {teleportModal && (
                <TeleportModal
                    {...teleportModal}
                    onClose={() => { setTeleportModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {healingIllusionModal && (
                <SecondaryTargetModal
                    title="Healing Illusion"
                    targets={buildHealingIllusionTargets(playerStats, characters, combatSummary)}
                    description={`The illusion has ended. Choose a creature within 5 feet to regain ${playerStats.level || 1} HP:`}
                    onTargetSelected={(targetName) => handleHealingIllusionConfirm(targetName, healingIllusionModal, characters, campaignName, () => { setHealingIllusionModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); })}
                    onSkip={() => { setHealingIllusionModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    confirmLabel="Heal"
                    confirmIcon="fa-heart"
                    showHp={true}
                    showSize={false}
                />
            )}
            {invokeDuplicityModal && (
                <CreatureSelectionModal
                    title="Improved Duplicity — Choose Allies"
                    icon="fa-people-arrows"
                    targets={buildInvokeDuplicityTargets(playerStats, characters, combatSummary)}
                    description="When you and your illusion are within 5 feet of a creature, your allies have Advantage on attack rolls against that creature."
                    note="Select all allies who should gain Advantage from the Improved Duplicity."
                    confirmLabel="Grant Advantage"
                    confirmIcon="fa-shield-halved"
                    onConfirm={(selected) => handleInvokeDuplicityConfirm(selected, invokeDuplicityModal, campaignName, () => { setInvokeDuplicityModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); })}
                    onSkip={() => { setInvokeDuplicityModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {saveAttackHealModal && (
                <SaveAttackHealModal
                    {...saveAttackHealModal}
                    onClose={() => setSaveAttackHealModal(null)}
                />
            )}
            {divineSparkModal && (
                <DivineSparkModal
                    {...divineSparkModal}
                    playerStats={playerStats}
                    onClose={() => setDivineSparkModal(null)}
                />
            )}
            {divineInterventionModal && (
                <DivineInterventionModal
                    {...divineInterventionModal}
                    onSelect={handleDivineInterventionCast}
                    onClose={() => {
                        setDivineInterventionModal(null);
                        setDivineInterventionAction(null);
                    }}
                />
            )}
            {arcaneChargeModal && (
                <ArcaneChargeModal
                    {...arcaneChargeModal}
                    onClose={() => setArcaneChargeModal(null)}
                />
            )}
            {warMagicCantripModal && (
                <WarMagicCantripModal
                    {...warMagicCantripModal}
                    onClose={() => setWarMagicCantripModal(null)}
                />
            )}
            {warMagicSpellModal && (
                <WarMagicSpellModal
                    {...warMagicSpellModal}
                    onClose={() => setWarMagicSpellModal(null)}
                />
            )}
            {sacredWeaponModal && (
                <SacredWeaponModal
                    {...sacredWeaponModal}
                    onClose={() => setSacredWeaponModal(null)}
                />
            )}
            {elderChampionRestoreModal && (
                <ElderChampionRestoreModal
                    action={elderChampionRestoreModal.payload.action}
                    playerStats={elderChampionRestoreModal.payload.playerStats}
                    campaignName={elderChampionRestoreModal.payload.campaignName}
                    onConfirm={() => {
                        handleElderChampionRestore(elderChampionRestoreModal.payload);
                        setElderChampionRestoreModal(null);
                    }}
                    onClose={() => setElderChampionRestoreModal(null)}
                />
            )}
            {primalCompanionBonusActionModal && (
                <PrimalCompanionBonusActionModal
                    {...primalCompanionBonusActionModal}
                    onClose={() => setPrimalCompanionBonusActionModal(null)}
                />
            )}
            {mistyWandererModal && (
                <MistyWandererModal
                    {...mistyWandererModal}
                    onClose={() => setMistyWandererModal(null)}
                />
            )}
            {bonusActionChoiceModal && (
                <BonusActionChoiceModal
                    {...bonusActionChoiceModal}
                    onClose={() => setBonusActionChoiceModal(null)}
                />
            )}
            {bastionOfLawModal && (
                <BastionOfLawModal
                    {...bastionOfLawModal}
                    onClose={() => setBastionOfLawModal(null)}
                />
            )}
            {elementalAffinityModal && (
                <ElementalAffinityModal
                    {...elementalAffinityModal}
                    onClose={() => setElementalAffinityModal(null)}
                />
            )}
            {fiendishResilienceModal && (
                <FiendishResilienceModal
                    {...fiendishResilienceModal}
                    onClose={() => setFiendishResilienceModal(null)}
                />
            )}
            {dragonCompanionModal && (
                <DragonCompanionModal
                    {...dragonCompanionModal}
                    onClose={() => setDragonCompanionModal(null)}
                />
            )}
            {wildMagicDoubleRollModal && (
                <WildMagicDoubleRollModal
                    {...wildMagicDoubleRollModal}
                    onClose={() => setWildMagicDoubleRollModal(null)}
                />
            )}
            {wildMagicTamedModal && (
                <WildMagicTamedModal
                    {...wildMagicTamedModal}
                    onClose={() => setWildMagicTamedModal(null)}
                />
            )}
            {thirdEyeModal && (
                <ThirdEyeModal
                    action={thirdEyeModal.action}
                    playerStats={thirdEyeModal.playerStats}
                    campaignName={thirdEyeModal.campaignName}
                    onClose={() => setThirdEyeModal(null)}
                />
            )}
            {soulstitchSpellsModal && (
                <SoulstitchSpellsModal
                    {...soulstitchSpellsModal}
                    onClose={() => setSoulstitchSpellsModal(null)}
                />
            )}
            {illusoryRealityModal && (
                <IllusoryRealityModal
                    {...illusoryRealityModal}
                    onClose={() => setIllusoryRealityModal(null)}
                />
            )}
            {celestialRevelationModal && (
                <CelestialRevelationModal
                    {...celestialRevelationModal}
                    onClose={() => setCelestialRevelationModal(null)}
                    onSetConditionModal={setSetConditionModal}
                />
            )}
            {fiendishLegacyModal && (
                <FiendishLegacyModal
                    {...fiendishLegacyModal}
                    onClose={() => setFiendishLegacyModal(null)}
                />
            )}
            {breathWeaponShapeModal && (
                <BreathWeaponShapeModal
                    {...breathWeaponShapeModal}
                    onClose={() => setBreathWeaponShapeModal(null)}
                />
            )}
            {hypnoticPatternShakeModal && (
                <HypnoticPatternShakeModal
                    {...hypnoticPatternShakeModal}
                    onClose={() => setHypnoticPatternShakeModal(null)}
                />
            )}
            {arcaneWardRestoreModal && (
                <ArcaneWardRestoreModal
                    {...arcaneWardRestoreModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setArcaneWardRestoreModal(null)}
                />
            )}
            {combatSuperiorityModal && (
                <CombatSuperiorityModal
                    {...combatSuperiorityModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setCombatSuperiorityModal(null)}
                    onConfirm={handleCombatSuperiorityConfirm}
                />
            )}
            {attackRiderManeuverPrompt && (
                <AttackRiderManeuverPrompt
                    maneuvers={attackRiderManeuverPrompt.maneuvers}
                    attack={attackRiderManeuverPrompt.attack}
                    popupHtml={attackRiderManeuverPrompt.popupHtml}
                    isMiss={attackRiderManeuverPrompt.isMiss}
                    onUse={handleAttackRiderManeuverUse}
                    onSkip={handleAttackRiderManeuverSkip}
                />
            )}
            {sweepingAttackTargetModal && (
                <SecondaryTargetModal
                    title="Sweeping Attack"
                    targets={sweepingAttackTargetModal.secondaryTargets}
                    description={`Choose a creature within 5 feet of ${sweepingAttackTargetModal.primaryTarget} to take ${sweepingAttackTargetModal.dieValue} damage:`}
                    onTargetSelected={(targetName) => handleSweepingAttackConfirm(targetName, sweepingAttackTargetModal)}
                    onSkip={() => setSweepingAttackTargetModal(null)}
                    confirmLabel="Apply Sweeping Attack"
                    confirmIcon="fa-bolt"
                    showSize={true}
                />
            )}
            {baitAndSwitchChoiceModal && (
                <SecondaryTargetModal
                    title="Bait and Switch — AC Bonus"
                    targets={baitAndSwitchChoiceModal.options}
                    description={baitAndSwitchChoiceModal.description}
                    onTargetSelected={(targetName) => handleBaitAndSwitchChoiceConfirm(targetName, baitAndSwitchChoiceModal)}
                    onSkip={() => setBaitAndSwitchChoiceModal(null)}
                    confirmLabel="Apply AC Bonus"
                    confirmIcon="fa-check"
                />
            )}
            {commanderStrikeChoiceModal && (
                <SecondaryTargetModal
                    title="Commander's Strike — Ally Attack"
                    targets={commanderStrikeChoiceModal.options}
                    description={commanderStrikeChoiceModal.description}
                    onTargetSelected={(targetName) => handleCommanderStrikeChoiceConfirm(targetName, commanderStrikeChoiceModal)}
                    onSkip={() => setCommanderStrikeChoiceModal(null)}
                    confirmLabel="Grant Attack"
                    confirmIcon="fa-check"
                />
            )}
            {rallyChoiceModal && (
                <SecondaryTargetModal
                    title="Rally"
                    targets={rallyChoiceModal.allyOptions}
                    description={rallyChoiceModal.description}
                    onTargetSelected={(targetName) => handleRallyChoiceConfirm(targetName, rallyChoiceModal)}
                    onSkip={() => setRallyChoiceModal(null)}
                    confirmLabel="Grant Temp HP"
                    confirmIcon="fa-heart"
                />
            )}
            {divineFuryChoice && (
                <div className="sp-overlay" onClick={handleDivineFurySkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> Divine Fury — Damage Type
                        </div>
                        <div className="sp-body">
                            <p>Choose the damage type for this hit:</p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <button className="sp-roll-btn" style={{ marginRight: '12px' }} onClick={() => handleDivineFuryDamageType('Necrotic')}>
                                    <i className="fa-solid fa-skull"></i> Necrotic
                                </button>
                                <button className="sp-roll-btn" onClick={() => handleDivineFuryDamageType('Radiant')}>
                                    <i className="fa-solid fa-sun"></i> Radiant
                                </button>
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={handleDivineFurySkip}>Skip</button>
                        </div>
                    </div>
                </div>
            )}
            {damageTypeChoice && (
                <div className="sp-overlay" onClick={() => {
                    if (pendingDamageRef.current?._attackRider) handleEnhancedUnarmedSkip();
                    else if (pendingDamageRef.current?._damageTypeModifier) handleDamageTypeModifierSkip();
                    else handleGenericDamageTypeSkip();
                }}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {damageTypeChoice.title}
                        </div>
                        <div className="sp-body">
                            <p>Choose the damage type for this hit:</p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {damageTypeChoice.types.map((type) => (
                                    <button
                                        key={type}
                                        className="sp-roll-btn"
                                        style={{ margin: '0 6px 8px 6px' }}
                                        onClick={() => {
                                            if (pendingDamageRef.current?._attackRider) handleEnhancedUnarmedChoice(type);
                                            else if (pendingDamageRef.current?._damageTypeModifier) handleDamageTypeModifierChoice(type);
                                            else handleGenericDamageTypeChoice(type);
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={() => {
                                if (pendingDamageRef.current?._attackRider) handleEnhancedUnarmedSkip();
                                else if (pendingDamageRef.current?._damageTypeModifier) handleDamageTypeModifierSkip();
                                else handleGenericDamageTypeSkip();
                            }}>Skip</button>
                        </div>
                    </div>
                </div>
            )}
            {featureChoice && (
                <div className="sp-overlay" onClick={handleFeatureChoiceSkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {featureChoice.action.name}
                        </div>
                        <div className="sp-body">
                            <p><b>Choose your option:</b></p>
                            <p style={{ opacity: 0.8, fontSize: '0.9em' }}>{featureChoice.action.description}</p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {featureChoice.options.map((opt, i) => {
                                    const optName = typeof opt === 'string' ? opt : opt.name;
                                    return (
                                        <button
                                            key={optName || i}
                                            className="sp-roll-btn"
                                            style={{ margin: '0 6px 8px 6px' }}
                                            onClick={() => handleFeatureChoiceConfirm(optName)}
                                        >
                                            {optName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={handleFeatureChoiceSkip}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {starryFormConstellationModal && (
                <ConstellationSelectionModal
                    action={starryFormConstellationModal.payload.action}
                    playerStats={starryFormConstellationModal.payload.playerStats}
                    campaignName={starryFormConstellationModal.payload.campaignName}
                    isTwinkled={false}
                    onConfirm={(option) => handleConstellationSelect(starryFormConstellationModal.payload, option)}
                    onClose={() => setStarryFormConstellationModal(null)}
                />
            )}
            {twinklingConstellationModal && (
                <ConstellationSelectionModal
                    action={twinklingConstellationModal.payload.action}
                    playerStats={twinklingConstellationModal.payload.playerStats}
                    campaignName={twinklingConstellationModal.payload.campaignName}
                    isTwinkled={true}
                    onConfirm={(option) => handleConstellationSelect(twinklingConstellationModal.payload, option)}
                    onClose={() => setTwinklingConstellationModal(null)}
                />
            )}
            {bulwarkOfForceModal && (
                <BulwarkOfForceModal
                    targets={bulwarkOfForceModal.creatureTargets}
                    maxTargets={bulwarkOfForceModal.maxTargets}
                    onConfirm={handleBulwarkOfForceConfirm}
                    onSkip={() => setBulwarkOfForceModal(null)}
                />
            )}
            {coronaEnemySelectionModal && (
                <CoronaEnemySelectionModal
                    creatureTargets={coronaEnemySelectionModal.creatureTargets}
                    onConfirm={handleCoronaEnemySelectionConfirm}
                    onSkip={() => setCoronaEnemySelectionModal(null)}
                />
            )}
            {radianceOfDawnModal && (
                <RadianceOfDawnModal
                    creatureTargets={radianceOfDawnModal.creatureTargets}
                    saveType={radianceOfDawnModal.saveType}
                    saveDc={radianceOfDawnModal.saveDc}
                    damageExpression={radianceOfDawnModal.damageExpression}
                    damageType={radianceOfDawnModal.damageType}
                    rangeFeet={radianceOfDawnModal.rangeFeet}
                    onConfirm={handleRadianceOfDawnConfirm}
                    onSkip={() => setRadianceOfDawnModal(null)}
                />
            )}
            {tricksterBlessingModal && (
                <SecondaryTargetModal
                    title="Blessing of the Trickster — Choose Target"
                    targets={tricksterBlessingModal.creatureTargets}
                    confirmLabel="Grant Blessing"
                    confirmIcon="fa-hands"
                    showHp={false}
                    onTargetSelected={handleTricksterBlessingConfirm}
                    onSkip={() => handleTricksterBlessingConfirm(null)}
                />
            )}
        </>
    )
}
