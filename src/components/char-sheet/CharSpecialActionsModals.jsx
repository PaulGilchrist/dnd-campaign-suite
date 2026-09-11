import { Fragment } from 'react';
import { applyTypeChoice as applyBoonOfEnergyResistance } from '../../services/automation/handlers/reactions/boonOfEnergyResistanceHandler.js';
import { isInteractive } from '../../services/ui/modalDismissUtils.js';
import TeleportModal from './modals/TeleportModal.jsx';
import SignatureSpellsModal from './modals/arcane/SignatureSpellsModal.jsx';
import SpellMasteryModal from './modals/arcane/SpellMasteryModal.jsx';
import SavantModal from './modals/arcane/SavantModal.jsx';
import CombatSuperiorityModal from './modals/CombatSuperiorityModal.jsx';
import WeaponKindMasteryModal from './modals/WeaponKindMasteryModal.jsx';
import WeaponMasteryChoiceModal from './modals/WeaponMasteryChoiceModal.jsx';
import ResourcePoolModal from './modals/ResourcePoolModal.jsx';
import NaturalRecoveryModal from './modals/NaturalRecoveryModal.jsx';
import CircleOfTheLandSpellsModal from './modals/CircleOfTheLandSpellsModal.jsx';
import ElementalAffinityModal from './modals/ElementalAffinityModal.jsx';
import SingleResistanceSelectionModal from './modals/SingleResistanceSelectionModal.jsx';
import MultiResistanceSelectionModal from './modals/MultiResistanceSelectionModal.jsx';
import WildMagicSurgeModal from './modals/WildMagicSurgeModal.jsx';
import StrideOfTheElementsModal from './modals/StrideOfTheElementsModal.jsx';
import ElementalEpitomeModal from './modals/ElementalEpitomeModal.jsx';
import DestructiveStrideModal from './modals/DestructiveStrideModal.jsx';
import QuiveringPalmModal from './modals/QuiveringPalmModal.jsx';
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx';
import StepsOfTheFeyTauntModal from './modals/StepsOfTheFeyTauntModal.jsx';
import HurlThroughHellModal from './modals/HurlThroughHellModal.jsx';
import ClairvoyantCombatantModal from './modals/ClairvoyantCombatantModal.jsx';
import CreatureSelectionModal from './modals/shared/CreatureSelectionModal.jsx';
import FeatureChoiceModal from './FeatureChoiceModal.jsx';
import AspectOfTheWildsModal from './AspectOfTheWildsModal.jsx';
import ElfisLineageModal from './ElfisLineageModal.jsx';
import GnomishLineageModal from './GnomishLineageModal.jsx';
import FeyReinforcementsModal from './modals/FeyReinforcementsModal.jsx';
import MistyWandererModal from './modals/MistyWandererModal.jsx';
import FiendishLegacyModal from './modals/FiendishLegacyModal.jsx';
import ConstellationSelectionModal from './modals/ConstellationSelectionModal.jsx';
import { applyConstellationOption as applyTwinklingConstellation } from '../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js';

function getEventDisplayLabel(eventType, eventData) {
    if (eventType === 'attack') {
        return `Attack vs AC ${eventData.targetName || 'unknown'}`;
    }
    if (eventType === 'ability') {
        return eventData.checkName || 'Ability check';
    }
    return eventData.saveType ? eventData.saveType.toUpperCase() : 'Save';
}

const TeleportBlock = ({ modal, onClose }) => (
    <TeleportModal
        action={modal.action}
        playerStats={modal.playerStats}
        campaignName={modal.campaignName}
        onClose={onClose}
        isMoonlightStep={modal.action?.automation?.effect === 'moonlight_step_teleport'}
    />
);

const MoonlightStepFallbackBlock = ({ fallback, onConfirm, onDismiss }) => (
    <div className="sp-overlay" onClick={(e) => {
        if (e.target.closest('.sp-modal')) return;
        onDismiss();
    }}>
        <div className="sp-modal">
            <div className="sp-header">
                <i className="fa-solid fa-moon"></i> {fallback.action.name}
            </div>
            <div className="sp-body">
                <p>No Moonlight Step uses remaining. Consume a level {fallback.slotLevel} spell slot to use Moonlight Step?</p>
            </div>
            <div className="sp-actions">
                <button className="sp-roll-btn" onClick={onConfirm}>
                    <i className="fa-solid fa-check"></i> Yes, Consume Slot
                </button>
                <button className="sp-dismiss-btn" onClick={onDismiss}>
                    <i className="fa-solid fa-times"></i> No
                </button>
            </div>
        </div>
    </div>
);

const PortentBlock = ({ portentModal, handlePortentModalClose, handlePortentDieChoice }) => (
    <div className="portent-modal-overlay" onClick={(e) => {
        if (e.target.closest('.portent-modal')) return;
        handlePortentModalClose?.();
    }}>
        <div className="portent-modal" onClick={(e) => {
            if (isInteractive(e.target)) return;
            handlePortentModalClose?.();
        }}>
            <h3>Portent</h3>
            <div className="portent-modal-section">
                <div className="portent-modal-label">Creature: <span className="portent-modal-target">{portentModal.targetName}</span></div>
                <div className="portent-modal-label">{getEventDisplayLabel(portentModal.eventType, portentModal.eventData)}</div>
                <div className="portent-modal-original">
                    d20({portentModal.eventData.d20}) + {portentModal.eventData.bonus} = {portentModal.eventData.d20 + portentModal.eventData.bonus}
                    {portentModal.eventType === 'attack' && ` (${portentModal.eventData.hit ? 'Hit' : 'Miss'})`}
                </div>
            </div>
            <div className="portent-modal-section">
                <div className="portent-modal-label">Choose a foretelling roll:</div>
                <div className="portent-dice-options">
                    {portentModal.diceOptions.map(die => (
                        <button key={die} className="portent-die-btn" onClick={() => handlePortentDieChoice(die)}>
                            {die}
                        </button>
                    ))}
                </div>
            </div>
            <div className="portent-modal-actions">
                <button className="portent-cancel-btn" onClick={handlePortentModalClose}>Cancel</button>
            </div>
        </div>
    </div>
);

const MultiResistanceBlock = ({ multiResistanceModal, setMultiResistanceModal, setPopupHtml }) => {
    const handleConfirm = async (selected) => {
        const payload = multiResistanceModal;
        setMultiResistanceModal(null);
        const res = await applyBoonOfEnergyResistance(payload.action, payload.playerStats, payload.campaignName, selected);
        if (res?.type === 'popup') {
            const html = `<b>${res.payload?.name || payload.action?.name}</b><br/>${res.payload?.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
        return res;
    };
    return (
        <MultiResistanceSelectionModal
            title={multiResistanceModal.action?.name || 'Energy Resistances'}
            icon="fa-shield-halved"
            damageTypes={multiResistanceModal.damageTypes}
            existingTypes={multiResistanceModal.existingTypes}
            maxSelections={multiResistanceModal.maxSelections || 2}
            action={multiResistanceModal.action}
            playerStats={multiResistanceModal.playerStats}
            campaignName={multiResistanceModal.campaignName}
            onConfirm={handleConfirm}
            onClose={() => setMultiResistanceModal(null)}
        />
    );
};

function CharSpecialActionsModals({
    teleportModal, setTeleportModal,
    moonlightStepFallback, setMoonlightStepFallback,
    signatureSpellsModal, setSignatureSpellsModal,
    spellMasteryModal, setSpellMasteryModal,
    savantModal, setSavantModal,
    combatSuperiorityModal, setCombatSuperiorityModal,
    weaponKindMasteryModal, setWeaponKindMasteryModal,
    weaponMasteryChoiceModal, setWeaponMasteryChoiceModal,
    resourcePoolModal, setResourcePoolModal,
    naturalRecoveryModal, setNaturalRecoveryModal,
    circleOfTheLandSpellsModal, setCircleOfTheLandSpellsModal,
    elementalAffinityModal, setElementalAffinityModal,
    wildMagicSurgeModal, setWildMagicSurgeModal,
    strideModal, setStrideModal,
    epitomeModal,
    destructiveStrideModal, setDestructiveStrideModal,
    destructiveStrideTargetModal,
    quiveringPalmModal, setQuiveringPalmModal,
    celestialResilienceModal,
    fiendishResilienceModal, setFiendishResilienceModal,
    multiResistanceModal, setMultiResistanceModal,
    stepsOfTheFeyTauntModal, setStepsOfTheFeyTauntModal,
    mistyWandererModal, setMistyWandererModal,
    twinklingConstellationModal, setTwinklingConstellationModal,
    hurlThroughHellModal, setHurlThroughHellModal,
    clairvoyantCombatantModal, setClairvoyantCombatantModal,
    portentModal,
    replenishingMealModal, setReplenishingMealModal,
    bolsteringTreatsModal, setBolsteringTreatsModal,
    bolsteringPerformanceModal, setBolsteringPerformanceModal,
    encouragingSongModal,
    elfishLineageModal,
    gnomishLineageModal, setGnomishLineageModal,
    feyReinforcementsModal, setFeyReinforcementsModal,
    fiendishLegacyModal, setFiendishLegacyModal,
    featureChoiceModal,
    aspectOfTheWildsModal,
    playerStats, campaignName,
    handleMoonlightStepFallbackConfirm,
    handleSignatureSpellsConfirm,
    handleSpellMasteryConfirm,
    handleSavantConfirm,
    handleCombatSuperiorityConfirm,
    handleCombatSuperiorityReopenSelection,
    handleStrideConfirm,
    handleEpitomeConfirm,
    handleEpitomeClose,
    handleDestructiveStrideConfirm,
    handleDestructiveStrideTargetConfirm,
    handleDestructiveStrideTargetSkip,
    handleCelestialResilienceConfirm,
    handleCelestialResilienceSkip,
    handlePortentModalClose,
    handlePortentDieChoice,
    handleFeatureChoiceConfirm,
    handleFeatureChoiceSkip,
    handleAspectOfTheWildsConfirm,
    handleAspectOfTheWildsSkip,
    handleReplenishingMealConfirm,
    handleBolsteringTreatsConfirm,
    handleBolsteringPerformanceConfirm,
    handleEncouragingSongConfirm,
    handleEncouragingSongSkip,
    handleElfisLineageConfirm,
    setElfisLineageModal,
    handleGnomishLineageConfirm,
    setPopupHtml,
}) {
    const MODAL_BLOCKS = [
            [teleportModal, () => (
                <TeleportBlock modal={teleportModal} onClose={() => setTeleportModal(null)} />
            )],
            [moonlightStepFallback, () => (
                <MoonlightStepFallbackBlock
                    fallback={moonlightStepFallback}
                    onConfirm={handleMoonlightStepFallbackConfirm}
                    onDismiss={() => setMoonlightStepFallback(null)}
                />
            )],
            [signatureSpellsModal, () => (
                <SignatureSpellsModal
                    payload={signatureSpellsModal}
                    onConfirm={handleSignatureSpellsConfirm}
                    onClose={() => setSignatureSpellsModal(null)}
                />
            )],
            [spellMasteryModal, () => (
                <SpellMasteryModal
                    payload={spellMasteryModal}
                    onConfirm={handleSpellMasteryConfirm}
                    onClose={() => setSpellMasteryModal(null)}
                />
            )],
            [savantModal, () => (
                <SavantModal
                    payload={savantModal}
                    onConfirm={handleSavantConfirm}
                    onClose={() => setSavantModal(null)}
                />
            )],
            [combatSuperiorityModal, () => (
                <CombatSuperiorityModal
                    payload={combatSuperiorityModal}
                    onConfirm={handleCombatSuperiorityConfirm}
                    onReopenSelection={handleCombatSuperiorityReopenSelection}
                    onClose={() => setCombatSuperiorityModal(null)}
                />
            )],
            [weaponKindMasteryModal, () => (
                <WeaponKindMasteryModal
                    {...weaponKindMasteryModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setWeaponKindMasteryModal(null)}
                />
            )],
            [weaponMasteryChoiceModal, () => (
                <WeaponMasteryChoiceModal
                    {...weaponMasteryChoiceModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setWeaponMasteryChoiceModal(null)}
                    onConfirm={() => setWeaponMasteryChoiceModal(null)}
                />
            )],
            [resourcePoolModal, () => (
                <ResourcePoolModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    automation={resourcePoolModal.automation}
                    onClose={() => setResourcePoolModal(null)}
                />
            )],
            [naturalRecoveryModal, () => (
                <NaturalRecoveryModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setNaturalRecoveryModal(null)}
                />
            )],
            [circleOfTheLandSpellsModal, () => (
                <CircleOfTheLandSpellsModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setCircleOfTheLandSpellsModal(null)}
                />
            )],
            [elementalAffinityModal, () => (
                <ElementalAffinityModal
                    action={elementalAffinityModal.action}
                    playerStats={elementalAffinityModal.playerStats}
                    campaignName={elementalAffinityModal.campaignName}
                    onClose={() => setElementalAffinityModal(null)}
                />
            )],
            [wildMagicSurgeModal, () => (
                <WildMagicSurgeModal
                    {...wildMagicSurgeModal}
                    onClose={() => setWildMagicSurgeModal(null)}
                />
            )],
            [strideModal, () => (
                <StrideOfTheElementsModal
                    action={strideModal.action}
                    playerStats={strideModal.playerStats}
                    campaignName={strideModal.campaignName}
                    onConfirm={handleStrideConfirm}
                    onClose={() => setStrideModal(null)}
                />
            )],
            [epitomeModal, () => (
                <ElementalEpitomeModal
                    action={epitomeModal.action}
                    playerStats={epitomeModal.playerStats}
                    campaignName={epitomeModal.campaignName}
                    currentResistance={epitomeModal.currentResistance}
                    onConfirm={handleEpitomeConfirm}
                    onClose={handleEpitomeClose}
                />
            )],
            [destructiveStrideModal, () => (
                <DestructiveStrideModal
                    action={destructiveStrideModal.action}
                    playerStats={destructiveStrideModal.playerStats}
                    campaignName={destructiveStrideModal.campaignName}
                    onConfirm={handleDestructiveStrideConfirm}
                    onClose={() => setDestructiveStrideModal(null)}
                />
            )],
            [destructiveStrideTargetModal, () => (
                <SecondaryTargetModal
                    title="Destructive Stride"
                    icon="fa-person-running"
                    targets={destructiveStrideTargetModal.targets || []}
                    description="Choose a creature within 5 ft. that you entered a space near while striding. A creature can take this damage only once per turn."
                    confirmLabel="Strike"
                    confirmIcon="fa-person-running"
                    onTargetSelected={handleDestructiveStrideTargetConfirm}
                    onSkip={handleDestructiveStrideTargetSkip}
                />
            )],
            [quiveringPalmModal, () => (
                <QuiveringPalmModal
                    {...quiveringPalmModal}
                    onClose={() => setQuiveringPalmModal(null)}
                />
            )],
            [stepsOfTheFeyTauntModal, () => (
                <StepsOfTheFeyTauntModal
                    {...stepsOfTheFeyTauntModal}
                    onClose={() => setStepsOfTheFeyTauntModal(null)}
                />
            )],
            [mistyWandererModal, () => (
                <MistyWandererModal
                    {...mistyWandererModal}
                    onClose={() => setMistyWandererModal(null)}
                />
            )],
            [twinklingConstellationModal, () => (
                <ConstellationSelectionModal
                    action={twinklingConstellationModal.action}
                    playerStats={twinklingConstellationModal.playerStats}
                    campaignName={twinklingConstellationModal.campaignName}
                    isTwinkled={true}
                    applyOption={applyTwinklingConstellation}
                    onConfirm={() => {}}
                    onClose={() => setTwinklingConstellationModal(null)}
                />
            )],
            [hurlThroughHellModal, () => (
                <HurlThroughHellModal
                    {...hurlThroughHellModal}
                    onClose={() => setHurlThroughHellModal(null)}
                />
            )],
            [clairvoyantCombatantModal, () => (
                <ClairvoyantCombatantModal
                    {...clairvoyantCombatantModal}
                    onClose={() => setClairvoyantCombatantModal(null)}
                />
            )],
            [portentModal, () => (
                <PortentBlock portentModal={portentModal} handlePortentModalClose={handlePortentModalClose} handlePortentDieChoice={handlePortentDieChoice} />
            )],
            [celestialResilienceModal, () => (
                <CreatureSelectionModal
                    title="Celestial Resilience"
                    icon="fa-shield-hart"
                    targets={celestialResilienceModal.creatureTargets}
                    maxTargets={celestialResilienceModal.maxTargets}
                    description="Choose up to 5 allies to gain temporary hit points from your Celestial Resilience."
                    note={`You gain ${celestialResilienceModal.selfTempHp} temporary hit points. Each selected ally gains ${celestialResilienceModal.allyTempHp} temporary hit points.`}
                    confirmLabel="Grant Resilience"
                    confirmIcon="fa-shield-hart"
                    onConfirm={handleCelestialResilienceConfirm}
                    onSkip={handleCelestialResilienceSkip}
                />
            )],
            [fiendishResilienceModal, () => (
                <SingleResistanceSelectionModal
                    {...fiendishResilienceModal}
                    onClose={() => setFiendishResilienceModal(null)}
                />
            )],
            [multiResistanceModal, () => (
                <MultiResistanceBlock multiResistanceModal={multiResistanceModal} setMultiResistanceModal={setMultiResistanceModal} setPopupHtml={setPopupHtml} />
            )],
            [featureChoiceModal, () => (
                <FeatureChoiceModal
                    featureChoiceModal={featureChoiceModal}
                    handleFeatureChoiceConfirm={handleFeatureChoiceConfirm}
                    handleFeatureChoiceSkip={handleFeatureChoiceSkip}
                />
            )],
            [aspectOfTheWildsModal, () => (
                <AspectOfTheWildsModal
                    aspectOfTheWildsModal={aspectOfTheWildsModal}
                    handleAspectOfTheWildsConfirm={handleAspectOfTheWildsConfirm}
                    handleAspectOfTheWildsSkip={handleAspectOfTheWildsSkip}
                />
            )],
            [replenishingMealModal, () => (
                <CreatureSelectionModal
                    title="Replenishing Meal"
                    icon="fa-utensils"
                    targets={replenishingMealModal.targets}
                    maxTargets={replenishingMealModal.maxTargets}
                    description="Choose creatures to receive a replenishing meal."
                    note="Each creature can hold at most 1 meal. During a Short Rest, a creature that eats the meal and rolls a Hit Die gains extra 1d8 HP."
                    confirmLabel="Distribute Meals"
                    confirmIcon="fa-utensils"
                    onConfirm={handleReplenishingMealConfirm}
                    onSkip={() => setReplenishingMealModal(null)}
                />
            )],
            [bolsteringTreatsModal, () => (
                <CreatureSelectionModal
                    title="Bolstering Treats"
                    icon="fa-cookie-bite"
                    targets={bolsteringTreatsModal.targets}
                    maxTargets={bolsteringTreatsModal.maxTargets}
                    description="Choose creatures to receive a bolstering treat."
                    note="Each creature can hold at most 1 treat. A creature with a treat can use a Bonus Action to gain Temporary Hit Points equal to your Proficiency Bonus."
                    confirmLabel="Distribute Treats"
                    confirmIcon="fa-cookie-bite"
                    onConfirm={handleBolsteringTreatsConfirm}
                    onSkip={() => setBolsteringTreatsModal(null)}
                />
            )],
            [bolsteringPerformanceModal, () => (
                <CreatureSelectionModal
                    title="Bolstering Performance"
                    icon="fa-bullhorn"
                    targets={bolsteringPerformanceModal.creatureTargets}
                    maxTargets={bolsteringPerformanceModal.maxTargets}
                    description="Choose up to 6 allies to gain temporary hit points."
                    note={`Each target gains ${bolsteringPerformanceModal.tempHp} temporary hit points.`}
                    confirmLabel="Inspire"
                    confirmIcon="fa-bullhorn"
                    onConfirm={handleBolsteringPerformanceConfirm}
                    onSkip={() => setBolsteringPerformanceModal(null)}
                />
            )],
            [encouragingSongModal, () => (
                <CreatureSelectionModal
                    title="Encouraging Song"
                    icon="fa-music"
                    targets={encouragingSongModal.creatureTargets}
                    maxTargets={encouragingSongModal.maxTargets}
                    description="Choose up to your Proficiency Bonus allies to hear your song and gain Heroic Inspiration."
                    confirmLabel="Inspire"
                    confirmIcon="fa-music"
                    onConfirm={handleEncouragingSongConfirm}
                    onSkip={handleEncouragingSongSkip}
                />
            )],
            [elfishLineageModal, () => (
                <ElfisLineageModal
                    elfishLineageModal={elfishLineageModal}
                    handleElfisLineageConfirm={handleElfisLineageConfirm}
                    handleElfisLineageSkip={() => setElfisLineageModal(null)}
                />
            )],
            [gnomishLineageModal, () => (
                <GnomishLineageModal
                    gnomishLineageModal={gnomishLineageModal}
                    handleGnomishLineageConfirm={handleGnomishLineageConfirm}
                    handleGnomishLineageSkip={() => setGnomishLineageModal(null)}
                />
            )],
            [feyReinforcementsModal, () => (
                <FeyReinforcementsModal
                    {...feyReinforcementsModal}
                    onClose={() => setFeyReinforcementsModal(null)}
                />
            )],
            [fiendishLegacyModal, () => (
                <FiendishLegacyModal
                    {...fiendishLegacyModal}
                    onClose={() => setFiendishLegacyModal(null)}
                />
            )],
    ];
    return <>{MODAL_BLOCKS.map(([flag, render], i) => (flag ? <Fragment key={i}>{render()}</Fragment> : null))}</>;
}

export default CharSpecialActionsModals;
