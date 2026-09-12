import React from 'react';
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx';
import CreatureSelectionModal from './modals/shared/CreatureSelectionModal.jsx';
import SaveAttackHealModal from './modals/shared/SaveAttackHealModal.jsx';
import SaveAttackAoeModal from './modals/shared/SaveAttackAoeModal.jsx';
import WarpingImplosionModal from './modals/WarpingImplosionModal.jsx';
import AOEConditionModal from './modals/shared/AOEConditionModal.jsx';
import FearModal from './modals/shared/FearModal.jsx';
import HypnoticPatternModal from './modals/shared/HypnoticPatternModal.jsx';
import SleepModal from './modals/shared/SleepModal.jsx';
import TashasLaughterModal from './modals/shared/TashasLaughterModal.jsx';
import SilenceModal from './modals/SilenceModal.jsx';
import MassSuggestionModal from './modals/shared/MassSuggestionModal.jsx';
import CalmEmotionsModal from './modals/shared/CalmEmotionsModal.jsx';
import CommandModal from './CommandModal.jsx';
import ElementalAttunementModal from './modals/ElementalAttunementModal.jsx';
import ElementalBurstModal from './modals/ElementalBurstModal.jsx';
import DivineSparkModal from './modals/divine/DivineSparkModal.jsx';
import DivineInterventionModal from './modals/divine/DivineInterventionModal.jsx';
import ArcaneChargeModal from './modals/arcane/ArcaneChargeModal.jsx';
import WarMagicCantripModal from './modals/WarMagicCantripModal.jsx';
import WarMagicSpellModal from './modals/WarMagicSpellModal.jsx';
import WarBondChooserModal from './modals/WarBondChooserModal.jsx';
import { handleSummon as handleWarBondSummon } from '../../services/automation/handlers/class-fighter-rogue/warBondHandler.js';
import SacredWeaponModal from './modals/divine/SacredWeaponModal.jsx';
import { cancelSacredWeapon } from '../../services/automation/handlers/class-cleric-paladin/sacredWeaponHandler.js';
import PrimalCompanionBonusActionModal from './modals/PrimalCompanionBonusActionModal.jsx';
import PrimalCompanionSummonModal from './modals/PrimalCompanionSummonModal.jsx';
import MistyWandererModal from './modals/MistyWandererModal.jsx';
import FeyReinforcementsModal from './modals/FeyReinforcementsModal.jsx';
import StepsOfTheFeyTauntModal from './modals/StepsOfTheFeyTauntModal.jsx';
import BonusActionChoiceModal from './modals/shared/BonusActionChoiceModal.jsx';
import StealthAttackModal from './modals/shared/StealthAttackModal.jsx';
import ElementalAffinityModal from './modals/ElementalAffinityModal.jsx';
import SingleResistanceSelectionModal from './modals/SingleResistanceSelectionModal.jsx';
import DragonCompanionModal from './modals/DragonCompanionModal.jsx';
import WildMagicSurgeModal from './modals/WildMagicSurgeModal.jsx';
import BendFateModal from './modals/BendFateModal.jsx';
import ThirdEyeModal from './modals/arcane/ThirdEyeModal.jsx';
import SoulstitchSpellsModal from './modals/arcane/SoulstitchSpellsModal.jsx';
import IllusoryRealityModal from './modals/arcane/IllusoryRealityModal.jsx';
import CelestialRevelationModal from './modals/CelestialRevelationModal.jsx';
import FiendishLegacyModal from './modals/FiendishLegacyModal.jsx';
import BreathWeaponShapeModal from './modals/racial/BreathWeaponShapeModal.jsx';
import HypnoticPatternShakeModal from './modals/shared/HypnoticPatternShakeModal.jsx';
import ArcaneWardRestoreModal from './modals/arcane/ArcaneWardRestoreModal.jsx';
import CombatSuperiorityModal from './modals/CombatSuperiorityModal.jsx';
import AttackRiderManeuverPrompt from './modals/AttackRiderManeuverPrompt.jsx';
import ConstellationSelectionModal from './modals/ConstellationSelectionModal.jsx';
import BulwarkOfForceModal from './modals/BulwarkOfForceModal.jsx';
import ZealousPresenceModal from './modals/ZealousPresenceModal.jsx';
import CoronaEnemySelectionModal from './modals/CoronaEnemySelectionModal.jsx';
import RadianceOfDawnModal from './modals/RadianceOfDawnModal.jsx';
import MantleOfInspirationModal from './modals/MantleOfInspirationModal.jsx';
import CelestialResilienceModal from './modals/CelestialResilienceModal.jsx';
import VitalityOfTheTreeModal from './modals/VitalityOfTheTreeModal.jsx';
import InspiringSmiteModal from './modals/InspiringSmiteModal.jsx';
import ElementalEpitomeModal from './modals/ElementalEpitomeModal.jsx';
import DestructiveStrideModal from './modals/DestructiveStrideModal.jsx';
import RecklessAttackModal from './modals/shared/RecklessAttackModal.jsx';
import ClockworkCavalcadeModal from './modals/divine/ClockworkCavalcadeModal.jsx';
import AnimateDeadModal from './modals/AnimateDeadModal.jsx';
import CreateUndeadModal from './modals/CreateUndeadModal.jsx';
import SummonSpiritModal from './modals/SummonSpiritModal.jsx';
import FlurryOfBlowsTargetPopup from './popups/FlurryOfBlowsTargetPopup.jsx';
import InlineChoiceModals from './modals/InlineChoiceModals.jsx';
import SecondaryTargetModals from './modals/SecondaryTargetModals.jsx';
import HealingModals from './modals/HealingModals.jsx';
import { confirmAnimateDead } from '../../services/automation/handlers/spells/animateDeadHandler.js';
import { applyTelekineticMovement } from '../../services/automation/handlers/class-sorcerer/telekineticMovementHandler.js';
import { confirmCreateUndead } from '../../services/automation/handlers/spells/createUndeadHandler.js';
import { confirmSummonSpirit } from '../../services/automation/handlers/spells/summonSpiritHandler.js';

function SpellEffectModals({ mergedModalState, setModalState, setPopupHtml }) {
    return (
        <>
            {mergedModalState.saveAttackHealModal && (
                <SaveAttackHealModal
                    {...mergedModalState.saveAttackHealModal}
                    onClose={() => setModalState({ saveAttackHealModal: null })}
                />
            )}
            {mergedModalState.saveAttackAoeModal && (
                <SaveAttackAoeModal
                    {...mergedModalState.saveAttackAoeModal}
                    onClose={() => setModalState({ saveAttackAoeModal: null })}
                />
            )}
            {mergedModalState.warpingImplosionModal && (
                <WarpingImplosionModal
                    {...mergedModalState.warpingImplosionModal}
                    onClose={() => setModalState({ warpingImplosionModal: null })}
                />
            )}
            {mergedModalState.aoeConditionModal && (
                <AOEConditionModal
                    {...mergedModalState.aoeConditionModal}
                    onClose={() => setModalState({ aoeConditionModal: null })}
                />
            )}
            {mergedModalState.fearModal && (
                <FearModal
                    {...mergedModalState.fearModal}
                    onClose={() => setModalState({ fearModal: null })}
                />
            )}
            {mergedModalState.sleepModal && (
                <SleepModal
                    {...mergedModalState.sleepModal}
                    onClose={() => setModalState({ sleepModal: null })}
                />
            )}
            {mergedModalState.hypnoticPatternModal && (
                <HypnoticPatternModal
                    {...mergedModalState.hypnoticPatternModal}
                    onClose={() => setModalState({ hypnoticPatternModal: null })}
                />
            )}
            {mergedModalState.tashasLaughterModal && (
                <TashasLaughterModal
                    {...mergedModalState.tashasLaughterModal}
                    onClose={() => setModalState({ tashasLaughterModal: null })}
                    setPopupHtml={setPopupHtml}
                />
            )}
            {mergedModalState.silenceModal && (
                <SilenceModal
                    {...mergedModalState.silenceModal}
                    onClose={() => setModalState({ silenceModal: null })}
                />
            )}
            {mergedModalState.massSuggestionModal && (
                <MassSuggestionModal
                    {...mergedModalState.massSuggestionModal}
                    onClose={() => setModalState({ massSuggestionModal: null })}
                />
            )}
            {mergedModalState.calmEmotionsModal && (
                <CalmEmotionsModal
                    {...mergedModalState.calmEmotionsModal}
                    onClose={() => setModalState({ calmEmotionsModal: null })}
                />
            )}
            {mergedModalState.commandModal && (
                <CommandModal
                    {...mergedModalState.commandModal}
                    onClose={() => setModalState({ commandModal: null })}
                />
            )}
        </>
    );
}

function SummonConfirmationModals({ mergedModalState, setModalState, setPopupHtml }) {
    return (
        <>
            {mergedModalState.animateDeadModal && (
                <AnimateDeadModal
                    maxTargets={mergedModalState.animateDeadModal.maxTargets}
                    onConfirm={async ({ zombieCount, skeletonCount }) => {
                        setModalState({ animateDeadModal: null });
                        const result = await confirmAnimateDead(
                            mergedModalState.animateDeadModal.action,
                            mergedModalState.animateDeadModal.playerStats,
                            mergedModalState.animateDeadModal.campaignName,
                            { zombieCount, skeletonCount }
                        );
                        if (result?.payload) {
                            setPopupHtml(result.payload);
                        }
                    }}
                    onClose={() => setModalState({ animateDeadModal: null })}
                />
            )}
            {mergedModalState.createUndeadModal && (
                <CreateUndeadModal
                    maxTargets={mergedModalState.createUndeadModal.maxTargets}
                    onConfirm={async ({ ghoulCount }) => {
                        setModalState({ createUndeadModal: null });
                        const result = await confirmCreateUndead(
                            mergedModalState.createUndeadModal.action,
                            mergedModalState.createUndeadModal.playerStats,
                            mergedModalState.createUndeadModal.campaignName,
                            { ghoulCount }
                        );
                        if (result?.payload) {
                            setPopupHtml(result.payload);
                        }
                    }}
                    onClose={() => setModalState({ createUndeadModal: null })}
                />
            )}
            {mergedModalState.summonSpiritModal && (
                <SummonSpiritModal
                    action={mergedModalState.summonSpiritModal.action}
                    onConfirm={async (variantName) => {
                        setModalState({ summonSpiritModal: null });
                        const result = await confirmSummonSpirit(
                            mergedModalState.summonSpiritModal.action,
                            mergedModalState.summonSpiritModal.playerStats,
                            mergedModalState.summonSpiritModal.campaignName,
                            variantName
                        );
                        if (result?.payload) {
                            setPopupHtml(result.payload);
                        }
                    }}
                    onClose={() => setModalState({ summonSpiritModal: null })}
                />
            )}
        </>
    );
}

function RecklessAttackHost({ mergedModalState, playerStats, campaignName, handleBrutalStrikeConfirm, handleBrutalStrikeCancel, handleRecklessAttackConfirm, handleRecklessAttackCancel }) {
    const rm = mergedModalState.recklessAttackModal;
    if (!rm) return null;
    return (
        <RecklessAttackModal
            playerStats={playerStats}
            campaignName={campaignName}
            attack={rm.attack}
            mode={rm.mode || 'full'}
            hasBrutalStrike={rm.hasBrutalStrike || false}
            brutalStrikeOptions={rm.brutalStrikeOptions || []}
            maxEffects={rm.maxEffects || 1}
            onConfirm={rm.mode === 'brutalOnly'
                ? (choice) => handleBrutalStrikeConfirm({ ...choice, riderName: rm.riderName })
                : (attack, choice) => handleRecklessAttackConfirm(attack, { ...choice, riderName: rm.riderName })}
            onCancel={rm.mode === 'brutalOnly'
                ? (choice) => handleBrutalStrikeCancel(choice)
                : () => handleRecklessAttackCancel(rm.attack)}
        />
    );
}

function AllySelectionModals({ mergedModalState, setModalState, handleMantleOfInspirationConfirm, handleCelestialResilienceConfirm, handleCelestialResilienceSkip, handleVitalityOfTheTreeConfirm, handleInspiringSmiteConfirm }) {
    return (
        <>
            {mergedModalState.mantleOfInspirationTarget && (
                <MantleOfInspirationModal
                    creatureTargets={mergedModalState.mantleOfInspirationTarget.creatureTargets}
                    tempHp={mergedModalState.mantleOfInspirationTarget.tempHp}
                    dieRoll={mergedModalState.mantleOfInspirationTarget.dieRoll}
                    bardicDieSize={mergedModalState.mantleOfInspirationTarget.bardicDieSize}
                    maxTargets={mergedModalState.mantleOfInspirationTarget.maxTargets}
                    onConfirm={handleMantleOfInspirationConfirm}
                    onSkip={() => setModalState({ mantleOfInspirationTarget: null })}
                />
            )}
            {mergedModalState.celestialResilienceModal && (
                <CelestialResilienceModal
                    creatureTargets={mergedModalState.celestialResilienceModal.creatureTargets}
                    allyTempHp={mergedModalState.celestialResilienceModal.allyTempHp}
                    selfTempHp={mergedModalState.celestialResilienceModal.selfTempHp}
                    maxTargets={mergedModalState.celestialResilienceModal.maxTargets}
                    onConfirm={handleCelestialResilienceConfirm}
                    onSkip={handleCelestialResilienceSkip}
                />
            )}
            {mergedModalState.vitalityOfTheTreeTarget && (
                <VitalityOfTheTreeModal
                    creatureTargets={mergedModalState.vitalityOfTheTreeTarget.creatureTargets}
                    tempHp={mergedModalState.vitalityOfTheTreeTarget.tempHp}
                    maxTargets={mergedModalState.vitalityOfTheTreeTarget.maxTargets}
                    onConfirm={handleVitalityOfTheTreeConfirm}
                    onSkip={() => setModalState({ vitalityOfTheTreeTarget: null })}
                />
            )}
            {mergedModalState.inspiringSmiteModal && (
                <InspiringSmiteModal
                    creatureTargets={mergedModalState.inspiringSmiteModal.creatureTargets}
                    tempHp={mergedModalState.inspiringSmiteModal.tempHp}
                    roll={mergedModalState.inspiringSmiteModal.roll}
                    onConfirm={handleInspiringSmiteConfirm}
                    onSkip={() => setModalState({ inspiringSmiteModal: null })}
                />
            )}
        </>
    );
}

function WarMagicFeatureModals({ mergedModalState, setModalState, campaignName }) {
    return (
        <>
            {mergedModalState.warMagicCantripModal && (
                <WarMagicCantripModal
                    {...mergedModalState.warMagicCantripModal}
                    onClose={() => setModalState({ warMagicCantripModal: null })}
                />
            )}
            {mergedModalState.warMagicSpellModal && (
                <WarMagicSpellModal
                    {...mergedModalState.warMagicSpellModal}
                    onClose={() => setModalState({ warMagicSpellModal: null })}
                />
            )}
            {mergedModalState.warBondSummonModal && (
                <WarBondChooserModal
                    title="War Bond — Summon Bonded Weapon"
                    icon="fa-link"
                    options={mergedModalState.warBondSummonModal.bondedWeapons}
                    maxChoices={1}
                    confirmLabel="Summon"
                    onConfirm={(selected) => handleWarBondSummon(mergedModalState.warBondSummonModal.action, mergedModalState.warBondSummonModal.playerStats, campaignName, selected[0])}
                    onClose={() => setModalState({ warBondSummonModal: null })}
                />
            )}
        </>
    );
}

function ArcaneFeatureModals({ mergedModalState, setModalState }) {
    return (
        <>
            {mergedModalState.thirdEyeModal && (
                <ThirdEyeModal
                    action={mergedModalState.thirdEyeModal.action}
                    playerStats={mergedModalState.thirdEyeModal.playerStats}
                    campaignName={mergedModalState.thirdEyeModal.campaignName}
                    onClose={() => setModalState({ thirdEyeModal: null })}
                />
            )}
            {mergedModalState.soulstitchSpellsModal && (
                <SoulstitchSpellsModal
                    {...mergedModalState.soulstitchSpellsModal}
                    onClose={() => setModalState({ soulstitchSpellsModal: null })}
                />
            )}
            {mergedModalState.illusoryRealityModal && (
                <IllusoryRealityModal
                    {...mergedModalState.illusoryRealityModal}
                    onClose={() => setModalState({ illusoryRealityModal: null })}
                />
            )}
        </>
    );
}

function DivineSparkFeatureModals({ mergedModalState, setModalState, playerStats, campaignName, handleDivineInterventionCast }) {
    return (
        <>
            {mergedModalState.elementalAttunementModal && (
                <ElementalAttunementModal
                    {...mergedModalState.elementalAttunementModal}
                    onClose={() => setModalState({ elementalAttunementModal: null })}
                />
            )}
            {mergedModalState.elementalBurstModal && (
                <ElementalBurstModal
                    {...mergedModalState.elementalBurstModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ elementalBurstModal: null })}
                />
            )}
            {mergedModalState.divineSparkModal && (
                <DivineSparkModal
                    {...mergedModalState.divineSparkModal}
                    playerStats={playerStats}
                    onClose={() => setModalState({ divineSparkModal: null })}
                />
            )}
            {mergedModalState.divineInterventionModal && (
                <DivineInterventionModal
                    {...mergedModalState.divineInterventionModal}
                    onSelect={handleDivineInterventionCast}
                    onClose={() => {
                        setModalState({ divineInterventionModal: null, divineInterventionAction: null });
                    }}
                />
            )}
            {mergedModalState.arcaneChargeModal && (
                <ArcaneChargeModal
                    {...mergedModalState.arcaneChargeModal}
                    onClose={() => setModalState({ arcaneChargeModal: null })}
                />
            )}
        </>
    );
}

function FeyCompanionModals({ mergedModalState, setModalState }) {
    return (
        <>
            {mergedModalState.primalCompanionBonusActionModal && (
                <PrimalCompanionBonusActionModal
                    {...mergedModalState.primalCompanionBonusActionModal}
                    onClose={() => setModalState({ primalCompanionBonusActionModal: null })}
                />
            )}
            {mergedModalState.primalCompanionSummonModal && (
                <PrimalCompanionSummonModal
                    {...mergedModalState.primalCompanionSummonModal}
                    onClose={() => setModalState({ primalCompanionSummonModal: null })}
                />
            )}
            {mergedModalState.mistyWandererModal && (
                <MistyWandererModal
                    {...mergedModalState.mistyWandererModal}
                    onClose={() => setModalState({ mistyWandererModal: null })}
                />
            )}
            {mergedModalState.feyReinforcementsModal && (
                <FeyReinforcementsModal
                    {...mergedModalState.feyReinforcementsModal}
                    onClose={() => setModalState({ feyReinforcementsModal: null })}
                />
            )}
            {mergedModalState.stepsOfTheFeyTauntModal && (
                <StepsOfTheFeyTauntModal
                    {...mergedModalState.stepsOfTheFeyTauntModal}
                    onClose={() => setModalState({ stepsOfTheFeyTauntModal: null })}
                />
            )}
        </>
    );
}

function StealthDragonModals({ mergedModalState, setModalState }) {
    return (
        <>
            {mergedModalState.stealthAttackModal && (
                <StealthAttackModal
                    {...mergedModalState.stealthAttackModal}
                    onClose={() => setModalState({ stealthAttackModal: null })}
                />
            )}
            {mergedModalState.elementalAffinityModal && (
                <ElementalAffinityModal
                    {...mergedModalState.elementalAffinityModal}
                    onClose={() => setModalState({ elementalAffinityModal: null })}
                />
            )}
            {mergedModalState.fiendishResilienceModal && (
                <SingleResistanceSelectionModal
                    {...mergedModalState.fiendishResilienceModal}
                    onClose={() => setModalState({ fiendishResilienceModal: null })}
                />
            )}
            {mergedModalState.dragonCompanionModal && (
                <DragonCompanionModal
                    {...mergedModalState.dragonCompanionModal}
                    onClose={() => setModalState({ dragonCompanionModal: null })}
                />
            )}
        </>
    );
}

function LegacyLineageModals({ mergedModalState, setModalState, playerStats, campaignName }) {
    return (
        <>
            {mergedModalState.celestialRevelationModal && (
                <CelestialRevelationModal
                    {...mergedModalState.celestialRevelationModal}
                    onClose={() => setModalState({ celestialRevelationModal: null })}
                    onSetConditionModal={setModalState}
                />
            )}
            {mergedModalState.fiendishLegacyModal && (
                <FiendishLegacyModal
                    {...mergedModalState.fiendishLegacyModal}
                    onClose={() => setModalState({ fiendishLegacyModal: null })}
                />
            )}
            {mergedModalState.breathWeaponShapeModal && (
                <BreathWeaponShapeModal
                    {...mergedModalState.breathWeaponShapeModal}
                    onClose={() => setModalState({ breathWeaponShapeModal: null })}
                />
            )}
            {mergedModalState.hypnoticPatternShakeModal && (
                <HypnoticPatternShakeModal
                    {...mergedModalState.hypnoticPatternShakeModal}
                    onClose={() => setModalState({ hypnoticPatternShakeModal: null })}
                />
            )}
            {mergedModalState.arcaneWardRestoreModal && (
                <ArcaneWardRestoreModal
                    {...mergedModalState.arcaneWardRestoreModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ arcaneWardRestoreModal: null })}
                />
            )}
        </>
    );
}

function CombatChoiceModals({
    mergedModalState,
    setModalState,
    combatSuperiorityModal,
    setCombatSuperiorityModal,
    handleCombatSuperiorityConfirm,
    handleAttackRiderManeuverUse,
    handleAttackRiderManeuverSkip,
    handleConstellationSelect,
    playerStats,
    campaignName,
}) {
    return (
        <>
            {combatSuperiorityModal && (
                <CombatSuperiorityModal
                    {...combatSuperiorityModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setCombatSuperiorityModal(null)}
                    onConfirm={handleCombatSuperiorityConfirm}
                />
            )}
            {mergedModalState.attackRiderManeuverPrompt && (
                <AttackRiderManeuverPrompt
                    maneuvers={mergedModalState.attackRiderManeuverPrompt.maneuvers}
                    attack={mergedModalState.attackRiderManeuverPrompt.attack}
                    popupHtml={mergedModalState.attackRiderManeuverPrompt.popupHtml}
                    isMiss={mergedModalState.attackRiderManeuverPrompt.isMiss}
                    onUse={handleAttackRiderManeuverUse}
                    onSkip={handleAttackRiderManeuverSkip}
                />
            )}
            {mergedModalState.starryFormConstellationModal && (
                <ConstellationSelectionModal
                    action={mergedModalState.starryFormConstellationModal.action}
                    playerStats={mergedModalState.starryFormConstellationModal.playerStats}
                    campaignName={mergedModalState.starryFormConstellationModal.campaignName}
                    isTwinkled={mergedModalState.starryFormConstellationModal.playerStats?.level >= 10}
                    onConfirm={(option) => handleConstellationSelect(mergedModalState.starryFormConstellationModal, option)}
                    onClose={() => setModalState({ starryFormConstellationModal: null })}
                />
            )}
            {mergedModalState.twinklingConstellationModal && (
                <ConstellationSelectionModal
                    action={mergedModalState.twinklingConstellationModal.action}
                    playerStats={mergedModalState.twinklingConstellationModal.playerStats}
                    campaignName={mergedModalState.twinklingConstellationModal.campaignName}
                    isTwinkled={true}
                    onConfirm={(option) => handleConstellationSelect(mergedModalState.twinklingConstellationModal, option)}
                    onClose={() => setModalState({ twinklingConstellationModal: null })}
                />
            )}
        </>
    );
}

function EnemySelectionModals({
    mergedModalState,
    setModalState,
    handleBulwarkOfForceConfirm,
    handleZealousPresenceConfirm,
    handlePsychicWhispersConfirm,
    handleCoronaEnemySelectionConfirm,
    handleRadianceOfDawnConfirm,
}) {
    return (
        <>
            {mergedModalState.bulwarkOfForceModal && (
                <BulwarkOfForceModal
                    targets={mergedModalState.bulwarkOfForceModal.creatureTargets}
                    maxTargets={mergedModalState.bulwarkOfForceModal.maxTargets}
                    onConfirm={handleBulwarkOfForceConfirm}
                    onSkip={() => setModalState({ bulwarkOfForceModal: null })}
                />
            )}
            {mergedModalState.zealousPresenceModal && (
                <ZealousPresenceModal
                    targets={mergedModalState.zealousPresenceModal.creatureTargets}
                    maxTargets={mergedModalState.zealousPresenceModal.maxTargets}
                    onConfirm={handleZealousPresenceConfirm}
                    onSkip={() => setModalState({ zealousPresenceModal: null })}
                />
            )}
            {mergedModalState.psychicWhispersModal && (
                <CreatureSelectionModal
                    title="Psychic Whispers"
                    icon="fa-brain"
                    targets={mergedModalState.psychicWhispersModal.creatureTargets}
                    maxTargets={mergedModalState.psychicWhispersModal.maxTargets}
                    description={`Choose up to ${mergedModalState.psychicWhispersModal.maxTargets} creatures within 35 feet to form a telepathic link. Roll one Psionic Energy Die (d${mergedModalState.psychicWhispersModal.dieSize}): link lasts for hours equal to the roll. First use after a Long Rest doesn't expend a die.`}
                    confirmLabel="Establish Link"
                    confirmIcon="fa-brain"
                    onConfirm={handlePsychicWhispersConfirm}
                    onSkip={() => setModalState({ psychicWhispersModal: null })}
                />
            )}
            {mergedModalState.coronaEnemySelectionModal && (
                <CoronaEnemySelectionModal
                    creatureTargets={mergedModalState.coronaEnemySelectionModal.creatureTargets}
                    onConfirm={handleCoronaEnemySelectionConfirm}
                    onSkip={() => setModalState({ coronaEnemySelectionModal: null })}
                />
            )}
            {mergedModalState.radianceOfDawnModal && (
                <RadianceOfDawnModal
                    creatureTargets={mergedModalState.radianceOfDawnModal.creatureTargets}
                    saveType={mergedModalState.radianceOfDawnModal.saveType}
                    saveDc={mergedModalState.radianceOfDawnModal.saveDc}
                    damageExpression={mergedModalState.radianceOfDawnModal.damageExpression}
                    damageType={mergedModalState.radianceOfDawnModal.damageType}
                    rangeFeet={mergedModalState.radianceOfDawnModal.rangeFeet}
                    onConfirm={handleRadianceOfDawnConfirm}
                    onSkip={() => setModalState({ radianceOfDawnModal: null })}
                />
            )}
        </>
    );
}

function SecondaryModals({
    mergedModalState,
    setModalState,
    setSpellModalState,
    combatSuperiorityModal,
    setCombatSuperiorityModal,
    handleCombatSuperiorityConfirm,
    handleAttackRiderManeuverUse,
    handleAttackRiderManeuverSkip,
    handleConstellationSelect,
    handleBulwarkOfForceConfirm,
    handleZealousPresenceConfirm,
    handlePsychicWhispersConfirm,
    handleCoronaEnemySelectionConfirm,
    handleRadianceOfDawnConfirm,
    handleMantleOfInspirationConfirm,
    handleCelestialResilienceConfirm,
    handleCelestialResilienceSkip,
    handleVitalityOfTheTreeConfirm,
    handleInspiringSmiteConfirm,
    handleEpitomeConfirm,
    handleDestructiveStrideConfirm,
    handleRecklessAttackConfirm,
    handleRecklessAttackCancel,
    handleBrutalStrikeConfirm,
    handleBrutalStrikeCancel,
    handleDivineInterventionCast,
    handleClockworkCavalcadeChoice,
    handleFlurryOfBlowsConfirm,
    playerStats,
    campaignName,
    characters,
    combatSummary,
    handleHealingIllusionConfirm,
    handleInvokeDuplicityConfirm,
    buildHealingIllusionTargets,
    buildInvokeDuplicityTargets,
    setPopupHtml,
    pendingDamage,
    mapName,
    buildCtx,
    buildCtxSync,
    rollDamage,
    handleDivineFuryDamageType,
    handleDivineFurySkip,
    handleEnhancedUnarmedChoice,
    handleEnhancedUnarmedSkip,
    handleGenericDamageTypeChoice,
    handleGenericDamageTypeSkip,
    handleDamageTypeModifierChoice,
    handleDamageTypeModifierSkip,
    handleFeatureChoiceConfirm,
    handleFeatureChoiceSkip,
    handleAttackRiderOptionSelect,
    handleClockworkCavalcadeRepairConfirm,
    sanitizeHtml,
    handleSweepingAttackConfirm,
    handleBaitAndSwitchChoiceConfirm,
    handleCommanderStrikeChoiceConfirm,
    handleRallyChoiceConfirm,
    handleTricksterBlessingConfirm,
    handleBardicInspirationConfirm,
    handleInspiringMovementConfirm,
    handleOceanicGiftConfirm,
    handleDestructiveStrideTargetConfirm,
    handleDestructiveStrideTargetSkip,
    handleStarryChaliceConfirm,
    handleMassHealConfirm,
    handleClockworkCavalcadeHealConfirm,
    handleClockworkCavalcadeDispelConfirm,
    handleMassCureWoundsConfirm,
    handlePrayerOfHealingConfirm,
    handlePowerWordFortifyConfirm,
    handleMassHealingWordConfirm,
    handleNaturesSanctuaryConfirm,
}) {
    return (
        <>
            {mergedModalState.healingIllusionModal && (
                <SecondaryTargetModal
                    title="Healing Illusion"
                    targets={buildHealingIllusionTargets()}
                    description={`The illusion has ended. Choose a creature within 5 feet to regain ${playerStats.level || 1} HP:`}
                    onTargetSelected={(targetName) => handleHealingIllusionConfirm(targetName, mergedModalState.healingIllusionModal, characters, campaignName, combatSummary, () => { setModalState({ healingIllusionModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); })}
                    onSkip={() => { setModalState({ healingIllusionModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    confirmLabel="Heal"
                    confirmIcon="fa-heart"
                    showHp={true}
                    showSize={false}
                />
            )}
            {mergedModalState.invokeDuplicityModal && (
                <CreatureSelectionModal
                    title="Improved Duplicity — Choose Allies"
                    icon="fa-people-arrows"
                    targets={buildInvokeDuplicityTargets()}
                    description="When you and your illusion are within 5 feet of a creature, your allies have Advantage on attack rolls against that creature."
                    note="Select all allies who should gain Advantage from the Improved Duplicity."
                    confirmLabel="Grant Advantage"
                    confirmIcon="fa-shield-halved"
                    onConfirm={(selected) => handleInvokeDuplicityConfirm(selected, mergedModalState.invokeDuplicityModal, campaignName, () => { setModalState({ invokeDuplicityModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); })}
                    onSkip={() => { setModalState({ invokeDuplicityModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            <SpellEffectModals mergedModalState={mergedModalState} setModalState={setModalState} setPopupHtml={setPopupHtml} />
            <DivineSparkFeatureModals mergedModalState={mergedModalState} setModalState={setModalState} playerStats={playerStats} campaignName={campaignName} handleDivineInterventionCast={handleDivineInterventionCast} />
            <WarMagicFeatureModals mergedModalState={mergedModalState} setModalState={setModalState} campaignName={campaignName} />
            {mergedModalState.sacredWeaponModal && (
                <SacredWeaponModal
                    {...mergedModalState.sacredWeaponModal}
                    onClose={() => setModalState({ sacredWeaponModal: null })}
                    onCancel={async () => {
                        // CLA-301: refund the Channel Divinity charge spent before the picker opened.
                        const payload = mergedModalState.sacredWeaponModal;
                        await cancelSacredWeapon(payload.action, payload.playerStats, payload.campaignName);
                        setModalState({ sacredWeaponModal: null });
                    }}
                />
            )}
            <FeyCompanionModals mergedModalState={mergedModalState} setModalState={setModalState} />
            {mergedModalState.telekineticMovementModal && (
                <CreatureSelectionModal
                    title="Telekinetic Movement — Choose Target"
                    icon="fa-hand"
                    maxTargets={1}
                    targets={mergedModalState.telekineticMovementModal.creatureTargets}
                    description={`Move one willing creature up to ${mergedModalState.telekineticMovementModal.rangeFt} feet.`}
                    note="Willingness is GM-adjudicated. Object movement is handled by the GM off the chooser."
                    confirmLabel="Move"
                    confirmIcon="fa-person-walking"
                    onConfirm={async (selected) => {
                        const tm = mergedModalState.telekineticMovementModal;
                        setModalState({ telekineticMovementModal: null });
                        const targetName = selected[0]?.name || selected[0];
                        if (!targetName) return;
                        const result = await applyTelekineticMovement(tm.action, tm.playerStats, tm.campaignName, targetName);
                        if (result?.type === 'popup') setPopupHtml(result.payload);
                    }}
                    onSkip={() => setModalState({ telekineticMovementModal: null })}
                />
            )}
            {mergedModalState.bonusActionChoiceModal && (
                <BonusActionChoiceModal
                    action={mergedModalState.bonusActionChoiceModal.action}
                    options={mergedModalState.bonusActionChoiceModal.options}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ bonusActionChoiceModal: null })}
                />
            )}
            <StealthDragonModals mergedModalState={mergedModalState} setModalState={setModalState} />
            {mergedModalState.wildMagicSurgeModal && (
                <WildMagicSurgeModal
                    {...mergedModalState.wildMagicSurgeModal}
                    onClose={() => {
                        setModalState({ wildMagicSurgeModal: null });
                        if (setSpellModalState) {
                            setSpellModalState({ wildMagicSurgeModal: null });
                        }
                    }}
                />
            )}
            {mergedModalState.bendFateModal && (
                <BendFateModal
                    {...mergedModalState.bendFateModal}
                    onClose={() => setModalState({ bendFateModal: null })}
                />
            )}
            <ArcaneFeatureModals mergedModalState={mergedModalState} setModalState={setModalState} />
            <LegacyLineageModals mergedModalState={mergedModalState} setModalState={setModalState} playerStats={playerStats} campaignName={campaignName} />
            <CombatChoiceModals
                mergedModalState={mergedModalState}
                setModalState={setModalState}
                combatSuperiorityModal={combatSuperiorityModal}
                setCombatSuperiorityModal={setCombatSuperiorityModal}
                handleCombatSuperiorityConfirm={handleCombatSuperiorityConfirm}
                handleAttackRiderManeuverUse={handleAttackRiderManeuverUse}
                handleAttackRiderManeuverSkip={handleAttackRiderManeuverSkip}
                handleConstellationSelect={handleConstellationSelect}
                playerStats={playerStats}
                campaignName={campaignName}
            />
            <EnemySelectionModals
                mergedModalState={mergedModalState}
                setModalState={setModalState}
                handleBulwarkOfForceConfirm={handleBulwarkOfForceConfirm}
                handleZealousPresenceConfirm={handleZealousPresenceConfirm}
                handlePsychicWhispersConfirm={handlePsychicWhispersConfirm}
                handleCoronaEnemySelectionConfirm={handleCoronaEnemySelectionConfirm}
                handleRadianceOfDawnConfirm={handleRadianceOfDawnConfirm}
            />
            <AllySelectionModals
                mergedModalState={mergedModalState}
                setModalState={setModalState}
                handleMantleOfInspirationConfirm={handleMantleOfInspirationConfirm}
                handleCelestialResilienceConfirm={handleCelestialResilienceConfirm}
                handleCelestialResilienceSkip={handleCelestialResilienceSkip}
                handleVitalityOfTheTreeConfirm={handleVitalityOfTheTreeConfirm}
                handleInspiringSmiteConfirm={handleInspiringSmiteConfirm}
            />
            {mergedModalState.epitomeModal && (
                <ElementalEpitomeModal
                    action={mergedModalState.epitomeModal.action}
                    playerStats={mergedModalState.epitomeModal.playerStats}
                    campaignName={mergedModalState.epitomeModal.campaignName}
                    currentResistance={mergedModalState.epitomeModal.currentResistance}
                    onConfirm={handleEpitomeConfirm}
                    onClose={() => setModalState({ epitomeModal: null })}
                />
            )}
            {mergedModalState.destructiveStrideModal && (
                <DestructiveStrideModal
                    action={mergedModalState.destructiveStrideModal.action}
                    playerStats={mergedModalState.destructiveStrideModal.playerStats}
                    campaignName={mergedModalState.destructiveStrideModal.campaignName}
                    onConfirm={handleDestructiveStrideConfirm}
                    onClose={() => setModalState({ destructiveStrideModal: null })}
                />
            )}
            <RecklessAttackHost
                mergedModalState={mergedModalState}
                playerStats={playerStats}
                campaignName={campaignName}
                handleBrutalStrikeConfirm={handleBrutalStrikeConfirm}
                handleBrutalStrikeCancel={handleBrutalStrikeCancel}
                handleRecklessAttackConfirm={handleRecklessAttackConfirm}
                handleRecklessAttackCancel={handleRecklessAttackCancel}
            />
            {mergedModalState.clockworkCavalcadeModal && (
                <ClockworkCavalcadeModal
                    onChoose={handleClockworkCavalcadeChoice}
                    onClose={() => setModalState({ clockworkCavalcadeModal: null })}
                />
            )}
            <SummonConfirmationModals mergedModalState={mergedModalState} setModalState={setModalState} setPopupHtml={setPopupHtml} />
            {mergedModalState.flurryOfBlowsModal && (
                <FlurryOfBlowsTargetPopup
                    totalAttacks={mergedModalState.flurryOfBlowsModal.numAttacks || 3}
                    creatureTargets={mergedModalState.flurryOfBlowsModal.creatureTargets}
                    currentTargetName={mergedModalState.flurryOfBlowsModal.currentTargetName}
                    onConfirm={handleFlurryOfBlowsConfirm}
                    onSkip={() => setModalState({ flurryOfBlowsModal: null })}
                />
            )}

            <InlineChoiceModals
                mergedModalState={mergedModalState}
                setModalState={setModalState}
                setPopupHtml={setPopupHtml}
                pendingDamage={pendingDamage}
                _mapName={mapName}
                _buildCtx={buildCtx}
                _buildCtxSync={buildCtxSync}
                _rollDamage={rollDamage}
                _playerStats={playerStats}
                _campaignName={campaignName}
                handleDivineFuryDamageType={handleDivineFuryDamageType}
                handleDivineFurySkip={handleDivineFurySkip}
                handleEnhancedUnarmedChoice={handleEnhancedUnarmedChoice}
                handleEnhancedUnarmedSkip={handleEnhancedUnarmedSkip}
                handleGenericDamageTypeChoice={handleGenericDamageTypeChoice}
                handleGenericDamageTypeSkip={handleGenericDamageTypeSkip}
                handleDamageTypeModifierChoice={handleDamageTypeModifierChoice}
                handleDamageTypeModifierSkip={handleDamageTypeModifierSkip}
                handleFeatureChoiceConfirm={handleFeatureChoiceConfirm}
                handleFeatureChoiceSkip={handleFeatureChoiceSkip}
                handleAttackRiderOptionSelect={handleAttackRiderOptionSelect}
                handleClockworkCavalcadeRepairConfirm={handleClockworkCavalcadeRepairConfirm}
                sanitizeHtml={sanitizeHtml}
            />

            <SecondaryTargetModals
                mergedModalState={mergedModalState}
                setModalState={setModalState}
                handleSweepingAttackConfirm={handleSweepingAttackConfirm}
                handleBaitAndSwitchChoiceConfirm={handleBaitAndSwitchChoiceConfirm}
                handleCommanderStrikeChoiceConfirm={handleCommanderStrikeChoiceConfirm}
                handleRallyChoiceConfirm={handleRallyChoiceConfirm}
                handleTricksterBlessingConfirm={handleTricksterBlessingConfirm}
                handleBardicInspirationConfirm={handleBardicInspirationConfirm}
                handleInspiringMovementConfirm={handleInspiringMovementConfirm}
                handleOceanicGiftConfirm={handleOceanicGiftConfirm}
                handleDestructiveStrideTargetConfirm={handleDestructiveStrideTargetConfirm}
                handleDestructiveStrideTargetSkip={handleDestructiveStrideTargetSkip}
                handleStarryChaliceConfirm={handleStarryChaliceConfirm}
            />

            <HealingModals
                mergedModalState={mergedModalState}
                setModalState={setModalState}
                handleMassHealConfirm={handleMassHealConfirm}
                handleClockworkCavalcadeHealConfirm={handleClockworkCavalcadeHealConfirm}
                handleClockworkCavalcadeDispelConfirm={handleClockworkCavalcadeDispelConfirm}
                handleMassCureWoundsConfirm={handleMassCureWoundsConfirm}
                handlePrayerOfHealingConfirm={handlePrayerOfHealingConfirm}
                handlePowerWordFortifyConfirm={handlePowerWordFortifyConfirm}
                handleMassHealingWordConfirm={handleMassHealingWordConfirm}
                handleNaturesSanctuaryConfirm={handleNaturesSanctuaryConfirm}
            />
        </>
    );
}

export default SecondaryModals;
