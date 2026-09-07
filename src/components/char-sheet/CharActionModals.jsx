import React, { useEffect } from 'react';
import { setSkipFlag } from '../../services/automation/common/oncePerTurn.js';
import HealingPoolModal from './modals/divine/HealingPoolModal.jsx'
import HandOfHealingModal from './modals/shared/HandOfHealingModal.jsx'
import FontOfMagicModal from './modals/FontOfMagicModal.jsx'
import ResourcePoolModal from './modals/ResourcePoolModal.jsx'
import WildCompanionModal from './modals/WildCompanionModal.jsx'
import SetConditionModal from './modals/shared/SetConditionModal.jsx'
import BlindnessDeafnessModal from './modals/BlindnessDeafnessModal.jsx'
import EyebiteEffectModal from './modals/EyebiteEffectModal.jsx'
import AttackRiderModal from './modals/shared/AttackRiderModal.jsx'
import OpenHandTechniqueModal from './modals/OpenHandTechniqueModal.jsx'
import ShieldBashChoiceModal from './modals/ShieldBashChoiceModal.jsx'
import QuiveringPalmModal from './modals/QuiveringPalmModal.jsx'
import WeaponMasteryModal from './modals/WeaponMasteryModal.jsx'
import WeaponMasteryChoiceModal from './modals/WeaponMasteryChoiceModal.jsx'
import WeaponKindMasteryModal from './modals/WeaponKindMasteryModal.jsx'
import BastionOfLawModal from './modals/divine/BastionOfLawModal.jsx'
import CombatStanceModal from './modals/shared/CombatStanceModal.jsx'
import TeleportModal from './modals/TeleportModal.jsx'
import RevelationInFleshModal from './modals/RevelationInFleshModal.jsx'
import MoonlightStepResourceModal from './modals/MoonlightStepResourceModal.jsx'
import { handleApply } from '../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js'
import { applyResistanceChoice } from '../../services/automation/handlers/combat/elementalEpitomeHandler.js'
import { applyDamageTypeChoice, applyTargetChoice, skipTargetChoice } from '../../services/automation/handlers/combat/destructiveStrideHandler.js'
import { applyStarryChaliceHeal } from '../../services/rules/spells/postCastHealService.js'
import { getCombatContext } from '../../services/rules/combat/damageUtils.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { sanitizeHtml } from '../../services/ui/sanitize.js'
import { logHealingToSSE } from '../../services/automation/common/healingRoll.js'
import { addEntry } from '../../services/ui/logService.js'
import SecondaryModals from './CharActionModals.SecondaryModals.jsx';
function CharActionModals({
    playerStats,
    campaignName,
    characters,
    _rollSkillCheck,
    _rollAbilityCheck,
    modalState,
    spellModalState,
    setModalState,
    setSpellModalState,
    combatSuperiorityModal, setCombatSuperiorityModal,
    handleCombatSuperiorityConfirm,
    handleAttackRiderManeuverUse,
    handleAttackRiderManeuverSkip,
    handleAttackRiderOptionSelect,
    handleSweepingAttackConfirm,
    handleBaitAndSwitchChoiceConfirm,
    handleCommanderStrikeChoiceConfirm,
    handleRallyChoiceConfirm,
    handleBulwarkOfForceConfirm,
    handleZealousPresenceConfirm,
    handlePsychicWhispersConfirm,
    handleNaturesSanctuaryConfirm,
    handleCoronaEnemySelectionConfirm,
    handleRadianceOfDawnConfirm,
    handleMantleOfInspirationConfirm,
    handleCelestialResilienceConfirm,
    handleCelestialResilienceSkip,
    handleVitalityOfTheTreeConfirm,
    handleInspiringSmiteConfirm,
    handleTricksterBlessingConfirm,
    handleBardicInspirationConfirm,
    handleInspiringMovementConfirm,
    handleOceanicGiftConfirm,
    handleDivineInterventionCast,
    pendingDamage,
    resumeAttackPipeline,
    buildCtx,
    buildCtxSync,
    rollDamage,
    setPopupHtml,
    mapName,
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
    handleRecklessAttackConfirm,
    handleRecklessAttackCancel,
    handleBrutalStrikeConfirm,
    handleBrutalStrikeCancel,
    handleMassHealConfirm,
    handleClockworkCavalcadeHealConfirm,
    handleClockworkCavalcadeDispelConfirm,
    handleClockworkCavalcadeRepairConfirm,
    handleMassCureWoundsConfirm,
    handlePrayerOfHealingConfirm,
    handlePowerWordFortifyConfirm,
    handleMassHealingWordConfirm,
    handleFlurryOfBlowsConfirm,
    handleOpenHandFromFlurryConfirm,
    handleOpenHandFromFlurrySkip,
}) {
    const [combatSummary, setCombatSummary] = React.useState(null);
    const mergedModalState = React.useMemo(() => {
        const result = { ...modalState, ...spellModalState };
        return result;
    }, [modalState, spellModalState]);

    useEffect(() => {
        getCombatContext(campaignName).then(cs => {
            if (cs) setCombatSummary(cs);
        });
    }, [campaignName]);

    const handleClockworkCavalcadeChoice = React.useCallback((choice) => {
        const choiceModal = mergedModalState.clockworkCavalcadeModal;
        if (!choiceModal) return;
        setModalState({ clockworkCavalcadeModal: null });
        if (choice === 'heal') {
            setModalState({ clockworkCavalcadeHealModal: choiceModal });
        } else if (choice === 'dispel') {
            setModalState({ clockworkCavalcadeDispelModal: choiceModal });
        } else if (choice === 'repair') {
            setModalState({ clockworkCavalcadeRepairModal: choiceModal });
        }
    }, [mergedModalState.clockworkCavalcadeModal, setModalState]);

    const handleStarryChaliceConfirm = async (targetName) => {
        setModalState({ starryChaliceHealModal: null });
        const result = await applyStarryChaliceHeal(targetName, campaignName);
        if (result) {
            setPopupHtml({
                type: 'heal',
                name: 'Starry Form: Chalice',
                formula: `${mergedModalState.starryChaliceHealModal.amount} HP`,
                rolls: [],
                total: mergedModalState.starryChaliceHealModal.amount,
                targetName: result.targetName,
                finalHeal: result.actualHeal,
            });
        }
    };

    const handleEpitomeConfirm = async (chosenType) => {
        setModalState({ epitomeModal: null });
        const result = await applyResistanceChoice(mergedModalState.epitomeModal?.action, playerStats, campaignName, chosenType);
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
    };

    const handleDestructiveStrideConfirm = async (chosenType) => {
        setModalState({ destructiveStrideModal: null });
        const result = await applyDamageTypeChoice(mergedModalState.destructiveStrideModal?.action, playerStats, campaignName, chosenType);
        if (result?.type === 'modal') {
            setModalState({ destructiveStrideTargetModal: result.payload });
        } else if (result?.payload) {
            setPopupHtml(result.payload);
        }
    };

    const handleDestructiveStrideTargetConfirm = async (targetName) => {
        const payload = mergedModalState.destructiveStrideTargetModal;
        setModalState({ destructiveStrideTargetModal: null });
        const result = await applyTargetChoice(payload?.action, playerStats, campaignName, targetName, payload?.chosenType, payload?.martialArtsDie);
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
    };

    const handleDestructiveStrideTargetSkip = async () => {
        const payload = mergedModalState.destructiveStrideTargetModal;
        setModalState({ destructiveStrideTargetModal: null });
        const result = await skipTargetChoice(payload?.action, playerStats, campaignName);
        if (result?.payload) {
            setPopupHtml(result.payload);
        }
    };

    const handleHealingIllusionConfirm = async (targetName, payload, characters, campaignName, combatSummary, onClose) => {
        const { action, playerStats } = payload;
        const casterName = playerStats.name;
        const stored = getRuntimeValue(casterName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        setRuntimeValue(casterName, 'activeBuffs', newBuffs, campaignName);
        setRuntimeValue(casterName, 'invokeDuplicityAdvantageTargets', [], campaignName);
        const healAmount = playerStats.level || 1;
        const maxHp = targetName === playerStats.name
            ? playerStats.hitPoints
            : (Number(getRuntimeValue(targetName, 'hitPoints', campaignName)) || findCreatureMaxHp(targetName, combatSummary, characters) || 0);
        const currentHp = Number(getRuntimeValue(targetName, 'currentHitPoints', campaignName)) || findCreatureCurrentHp(targetName, combatSummary) || 0;
        const newHp = Math.min(maxHp, currentHp + healAmount);
        await setRuntimeValue(targetName, 'currentHitPoints', newHp, campaignName);
        logHealingToSSE(campaignName, {
            targetName,
            sourceName: action.name,
            actualHeal: newHp - currentHp,
            newHp,
            maxHp,
            healingName: 'Healing Illusion',
        });
        onClose();
    };

    const findCreatureMaxHp = (targetName, combatSummary, characters) => {
        const creature = combatSummary?.creatures?.find(c => c.name === targetName);
        if (creature?.maxHp) return creature.maxHp;
        const char = characters?.find(c => c.name === targetName);
        return char?.maxHp;
    };

    const findCreatureCurrentHp = (targetName, combatSummary) => {
        const creature = combatSummary?.creatures?.find(c => c.name === targetName);
        return creature?.currentHp;
    };

    const buildHealingIllusionTargets = () => {
        const allCreatures = [...(characters || []), ...(combatSummary?.creatures || [])];
        const names = new Set(allCreatures.map(c => c.name));
        const result = Array.from(names)
            .map(name => {
                const creature = allCreatures.find(c => c.name === name);
                return { name: creature.name, type: creature.type, size: creature.size, currentHp: creature.currentHp, maxHp: creature.maxHp };
            });
        return result;
    };

    const buildInvokeDuplicityTargets = () => {
        const allCreatures = [...(characters || []), ...(combatSummary?.creatures || [])];
        const names = new Set(allCreatures.map(c => c.name));
        const result = Array.from(names)
            .map(name => {
                const creature = allCreatures.find(c => c.name === name);
                return { name: creature.name, type: creature.type, currentHp: creature.currentHp, maxHp: creature.maxHp };
            });
        return result;
    };

    const handleInvokeDuplicityConfirm = async (selectedAllyNames, payload, campaignName, onClose) => {
        const { playerStats } = payload;
        if (selectedAllyNames.length === 0) {
            onClose();
            return;
        }
        await setRuntimeValue(playerStats.name, 'invokeDuplicityAdvantageTargets', selectedAllyNames, campaignName);
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Improved Duplicity',
            description: `${playerStats.name} used Improved Duplicity, granting Advantage to ${selectedAllyNames.join(', ')}.`,
        }).catch((e) => { console.error("[charActionModals:log-error]", e); });
        window.dispatchEvent(new CustomEvent('buffs-updated'));
        onClose();
    };

    const handleAttackRiderClose = async () => {
        const modalAction = mergedModalState.attackRiderModal?.action;
        const modalPlayerStats = mergedModalState.attackRiderModal?.playerStats;
        const modalCampaignName = mergedModalState.attackRiderModal?.campaignName;
        setModalState({ attackRiderModal: null });
        window.dispatchEvent(new CustomEvent('target-effects-updated'));
        if (modalAction?.name === "Stalker's Flurry") {
            const optKey = `_${modalAction.name.replace(/\s+/g, '_')}_option`;
            const chosen = getRuntimeValue(modalPlayerStats.name, optKey, modalCampaignName);
            if (!chosen) {
                const skipKey = `_${modalAction.name.replace(/\s+/g, '_')}_skippedRound`;
                await setSkipFlag(skipKey, modalPlayerStats, modalCampaignName);
            }
            // CLA-326: the featureRiders step paused BEFORE proceedToDamage while
            // this modal was open. Resume so the triggering hit's weapon damage
            // lands; stalkersFlurryPostDamage (Sudden Strike) then runs downstream
            // off damage:applied. oncePerTurn is already stamped by applyRiderOption
            // (Apply path) or gated by the skip flag (Cancel path).
            await resumeAttackPipeline?.();
        }
        const isCunningStrikeVariant = ['Cunning Strike', 'Improved Cunning Strike', 'Devious Strikes'].includes(modalAction?.name);
        if (isCunningStrikeVariant) {
            resumeAttackPipeline?.();
        }
    };

    return (
        <>
            {mergedModalState.healingPoolModal && (
                <HealingPoolModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    name={mergedModalState.healingPoolModal.name}
                    poolMax={mergedModalState.healingPoolModal.pool}
                    poolExpression={mergedModalState.healingPoolModal.poolExpression}
                    isDicePool={mergedModalState.healingPoolModal.isDicePool}
                    dieType={mergedModalState.healingPoolModal.dieType}
                    resourceKey={mergedModalState.healingPoolModal.resourceKey}
                    alsoCures={mergedModalState.healingPoolModal.alsoCures}
                    cureCost={mergedModalState.healingPoolModal.cureCost}
                    bloodiedOnly={mergedModalState.healingPoolModal.bloodiedOnly}
                    restoringTouchConditions={mergedModalState.healingPoolModal.restoringTouchConditions}
                    maxDicePerUse={mergedModalState.healingPoolModal.maxDicePerUse}
                    creatureTargets={mergedModalState.healingPoolModal.creatureTargets}
                    resourceCost={mergedModalState.healingPoolModal.resourceCost}
                    onClose={() => setModalState({ healingPoolModal: null })}
                />
            )}
            {mergedModalState.handOfHealingModal && (
                <HandOfHealingModal
                    {...mergedModalState.handOfHealingModal}
                    campaignName={campaignName}
                    onClose={() => setModalState({ handOfHealingModal: null })}
                />
            )}
            {mergedModalState.fontOfMagicModal && (
                <FontOfMagicModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ fontOfMagicModal: null })}
                />
            )}
            {mergedModalState.resourcePoolModal && (
                <ResourcePoolModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    automation={mergedModalState.resourcePoolModal.automation}
                    onClose={() => setModalState({ resourcePoolModal: null })}
                />
            )}
            {mergedModalState.moonlightStepResourceModal && (
                <MoonlightStepResourceModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    automation={mergedModalState.moonlightStepResourceModal.automation}
                    onClose={() => setModalState({ moonlightStepResourceModal: null })}
                />
            )}
            {mergedModalState.wildCompanionModal && (
                <WildCompanionModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ wildCompanionModal: null })}
                />
            )}
            {mergedModalState.setConditionModal && (
                <SetConditionModal
                    {...mergedModalState.setConditionModal}
                    characters={characters}
                    onClose={() => setModalState({ setConditionModal: null })}
                />
            )}
            {mergedModalState.blindnessDeafnessModal && (
                <BlindnessDeafnessModal
                    {...mergedModalState.blindnessDeafnessModal}
                    characters={characters}
                    onClose={() => setModalState({ blindnessDeafnessModal: null })}
                />
            )}
            {mergedModalState.eyebiteEffectModal && (
                <EyebiteEffectModal
                    {...mergedModalState.eyebiteEffectModal}
                    characters={characters}
                    onClose={() => setModalState({ eyebiteEffectModal: null })}
                />
            )}
            {mergedModalState.attackRiderModal && (
                <AttackRiderModal
                    {...mergedModalState.attackRiderModal}
                    onClose={handleAttackRiderClose}
                />
            )}
            {mergedModalState.openHandTechniqueModal && (
                <OpenHandTechniqueModal
                    {...mergedModalState.openHandTechniqueModal}
                    onClose={() => { setModalState({ openHandTechniqueModal: null }); window.dispatchEvent(new CustomEvent('target-effects-updated')); window.dispatchEvent(new CustomEvent('combat-summary-updated')); }}
                />
            )}
            {mergedModalState.shieldBashModal && (
                <ShieldBashChoiceModal
                    {...mergedModalState.shieldBashModal}
                    onClose={() => { setModalState({ shieldBashModal: null }); window.dispatchEvent(new CustomEvent('target-effects-updated')); window.dispatchEvent(new CustomEvent('combat-summary-updated')); return resumeAttackPipeline?.(); }}
                />
            )}
            {mergedModalState.quiveringPalmModal && (
                <QuiveringPalmModal
                    {...mergedModalState.quiveringPalmModal}
                    onClose={() => { setModalState({ quiveringPalmModal: null }); window.dispatchEvent(new CustomEvent('target-effects-updated')); window.dispatchEvent(new CustomEvent('combat-summary-updated')); }}
                />
            )}
            {mergedModalState.openHandFromFlurry && (
                <OpenHandTechniqueModal
                    action={mergedModalState.openHandFromFlurry.targets[mergedModalState.openHandFromFlurry.currentIndex]?.action}
                    playerStats={mergedModalState.openHandFromFlurry.targets[mergedModalState.openHandFromFlurry.currentIndex]?.playerStats}
                    campaignName={mergedModalState.openHandFromFlurry.targets[mergedModalState.openHandFromFlurry.currentIndex]?.campaignName}
                    targetName={mergedModalState.openHandFromFlurry.targets[mergedModalState.openHandFromFlurry.currentIndex]?.targetName}
                    saveDc={mergedModalState.openHandFromFlurry.saveDc}
                    onClose={() => { handleOpenHandFromFlurrySkip(); window.dispatchEvent(new CustomEvent('target-effects-updated')); window.dispatchEvent(new CustomEvent('combat-summary-updated')); }}
                    onConfirm={(optionName) => { handleOpenHandFromFlurryConfirm({ optionName }); window.dispatchEvent(new CustomEvent('target-effects-updated')); window.dispatchEvent(new CustomEvent('combat-summary-updated')); }}
                />
            )}
            {mergedModalState.weaponMasteryModal && (
                <WeaponMasteryModal
                    {...mergedModalState.weaponMasteryModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    targetName={null}
                    onClose={handleMasteryClose}
                />
            )}
            {mergedModalState.weaponMasteryChoiceModal && (
                <WeaponMasteryChoiceModal
                    {...mergedModalState.weaponMasteryChoiceModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => { setModalState({ weaponMasteryChoiceModal: null }); }}
                    onConfirm={handleWeaponMasteryChoice}
                />
            )}
            {mergedModalState.weaponKindMasteryModal && (
                <WeaponKindMasteryModal
                    {...mergedModalState.weaponKindMasteryModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={handleWeaponKindMasteryClose}
                />
            )}
            {mergedModalState.combatStanceModal && (
                <CombatStanceModal
                    {...mergedModalState.combatStanceModal}
                    onClose={() => { setModalState({ combatStanceModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {mergedModalState.revelationInFleshModal && (
                <RevelationInFleshModal
                    {...mergedModalState.revelationInFleshModal}
                    onClose={() => { setModalState({ revelationInFleshModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {mergedModalState.bastionOfLawModal && (
                <BastionOfLawModal
                    {...mergedModalState.bastionOfLawModal}
                    campaignName={campaignName}
                    onConfirm={async (spAmount, selectedTargetName) => {
                        const action = { name: mergedModalState.bastionOfLawModal.featureName, automation: mergedModalState.bastionOfLawModal.auto };
                        const result = await handleApply(action, playerStats, campaignName, spAmount, selectedTargetName);
                        if (result?.payload) {
                            setPopupHtml(result.payload);
                        }
                        setModalState({ bastionOfLawModal: null });
                    }}
                    onClose={() => setModalState({ bastionOfLawModal: null })}
                />
            )}
            {mergedModalState.teleportModal && (
                <TeleportModal
                    {...mergedModalState.teleportModal}
                    onClose={() => { setModalState({ teleportModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    isMoonlightStep={mergedModalState.teleportModal.action?.automation?.effect === 'moonlight_step_teleport'}
                />
            )}
            <SecondaryModals
                mergedModalState={mergedModalState}
                setModalState={setModalState}
                setSpellModalState={setSpellModalState}
                combatSuperiorityModal={combatSuperiorityModal}
                setCombatSuperiorityModal={setCombatSuperiorityModal}
                handleCombatSuperiorityConfirm={handleCombatSuperiorityConfirm}
                handleAttackRiderManeuverUse={handleAttackRiderManeuverUse}
                handleAttackRiderManeuverSkip={handleAttackRiderManeuverSkip}
                handleConstellationSelect={handleConstellationSelect}
                handleBulwarkOfForceConfirm={handleBulwarkOfForceConfirm}
                handleZealousPresenceConfirm={handleZealousPresenceConfirm}
                handlePsychicWhispersConfirm={handlePsychicWhispersConfirm}
                handleCoronaEnemySelectionConfirm={handleCoronaEnemySelectionConfirm}
                handleRadianceOfDawnConfirm={handleRadianceOfDawnConfirm}
                handleMantleOfInspirationConfirm={handleMantleOfInspirationConfirm}
                handleCelestialResilienceConfirm={handleCelestialResilienceConfirm}
                handleCelestialResilienceSkip={handleCelestialResilienceSkip}
                handleVitalityOfTheTreeConfirm={handleVitalityOfTheTreeConfirm}
                handleInspiringSmiteConfirm={handleInspiringSmiteConfirm}
                handleEpitomeConfirm={handleEpitomeConfirm}
                handleDestructiveStrideConfirm={handleDestructiveStrideConfirm}
                handleRecklessAttackConfirm={handleRecklessAttackConfirm}
                handleRecklessAttackCancel={handleRecklessAttackCancel}
                handleBrutalStrikeConfirm={handleBrutalStrikeConfirm}
                handleBrutalStrikeCancel={handleBrutalStrikeCancel}
                handleDivineInterventionCast={handleDivineInterventionCast}
                handleClockworkCavalcadeChoice={handleClockworkCavalcadeChoice}
                handleFlurryOfBlowsConfirm={handleFlurryOfBlowsConfirm}
                playerStats={playerStats}
                campaignName={campaignName}
                characters={characters}
                combatSummary={combatSummary}
                handleHealingIllusionConfirm={handleHealingIllusionConfirm}
                handleInvokeDuplicityConfirm={handleInvokeDuplicityConfirm}
                buildHealingIllusionTargets={buildHealingIllusionTargets}
                buildInvokeDuplicityTargets={buildInvokeDuplicityTargets}
                setPopupHtml={setPopupHtml}
                pendingDamage={pendingDamage}
                mapName={mapName}
                buildCtx={buildCtx}
                buildCtxSync={buildCtxSync}
                rollDamage={rollDamage}
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

export default CharActionModals;
