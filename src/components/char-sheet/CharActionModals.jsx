import { confirmTeleport } from '../../services/automation/handlers/class-warlock/tempTeleportHandler.js';
import React, { useEffect } from 'react';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { setSkipFlag } from '../../services/automation/common/oncePerTurn.js';
import HealingPoolModal from './modals/divine/HealingPoolModal.jsx'
import HandOfHealingModal from './modals/shared/HandOfHealingModal.jsx'
import FontOfMagicModal from './modals/FontOfMagicModal.jsx'
import ResourcePoolModal from './modals/ResourcePoolModal.jsx'
import WildCompanionModal from './modals/WildCompanionModal.jsx'
import SetConditionModal from './modals/shared/SetConditionModal.jsx'
import EyebiteEffectModal from './modals/EyebiteEffectModal.jsx'
import AttackRiderModal from './modals/shared/AttackRiderModal.jsx'
import StealthAttackModal from './modals/shared/StealthAttackModal.jsx'
import OpenHandTechniqueModal from './modals/OpenHandTechniqueModal.jsx'
import WeaponMasteryModal from './modals/WeaponMasteryModal.jsx'
import WeaponMasteryChoiceModal from './modals/WeaponMasteryChoiceModal.jsx'
import WeaponKindMasteryModal from './modals/WeaponKindMasteryModal.jsx'
import BastionOfLawModal from './modals/divine/BastionOfLawModal.jsx'
import CombatStanceModal from './modals/shared/CombatStanceModal.jsx'
import TeleportModal from './modals/TeleportModal.jsx'
import SaveAttackHealModal from './modals/shared/SaveAttackHealModal.jsx'
import SaveAttackAoeModal from './modals/shared/SaveAttackAoeModal.jsx'
import DivineSparkModal from './modals/divine/DivineSparkModal.jsx'
import DivineInterventionModal from './modals/divine/DivineInterventionModal.jsx'
import ArcaneChargeModal from './modals/arcane/ArcaneChargeModal.jsx'
import WarMagicCantripModal from './modals/WarMagicCantripModal.jsx'
import WarMagicSpellModal from './modals/WarMagicSpellModal.jsx'
import SacredWeaponModal from './modals/divine/SacredWeaponModal.jsx'
import ElderChampionRestoreModal from './modals/ElderChampionRestoreModal.jsx'
import PrimalCompanionBonusActionModal from './modals/PrimalCompanionBonusActionModal.jsx'
import MistyWandererModal from './modals/MistyWandererModal.jsx'
import FeyReinforcementsModal from './modals/FeyReinforcementsModal.jsx'
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
import ZealousPresenceModal from './modals/ZealousPresenceModal.jsx'
import CoronaEnemySelectionModal from './modals/CoronaEnemySelectionModal.jsx'
import RadianceOfDawnModal from './modals/RadianceOfDawnModal.jsx'
import MantleOfInspirationModal from './modals/MantleOfInspirationModal.jsx'
import VitalityOfTheTreeModal from './modals/VitalityOfTheTreeModal.jsx'
import InspiringSmiteModal from './modals/InspiringSmiteModal.jsx'
import RecklessAttackModal from './modals/shared/RecklessAttackModal.jsx'
import { handleClearWard, handleSpendDice, handleApply } from '../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js'
import { getCombatContext } from '../../services/rules/combat/damageUtils.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { sanitizeHtml } from '../../services/ui/sanitize.js'


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
    return result;
}

async function handleHealingIllusionConfirm(targetName, payload, characters, campaignName, combatSummary, onClose) {
    const { action, playerStats } = payload;
    const casterName = playerStats.name;
    const stored = getRuntimeValue(casterName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = activeBuffs.filter(b => b.name !== action.name);
    setRuntimeValue(casterName, 'activeBuffs', newBuffs, campaignName);
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
}

function findCreatureMaxHp(targetName, combatSummary, characters) {
    const creature = combatSummary?.creatures?.find(c => c.name === targetName);
    if (creature?.maxHp) return creature.maxHp;
    const char = characters?.find(c => c.name === targetName);
    return char?.maxHp;
}

function findCreatureCurrentHp(targetName, combatSummary) {
    const creature = combatSummary?.creatures?.find(c => c.name === targetName);
    return creature?.currentHp;
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
    return result;
}

async function handleInvokeDuplicityConfirm(selectedAllyNames, payload, campaignName, onClose) {
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
    }).catch(() => {});
    window.dispatchEvent(new CustomEvent('buffs-updated'));
    onClose();
}

export default function CharActionModals({
    playerStats,
    campaignName,
    characters,
    _rollSkillCheck,
    _rollAbilityCheck,
    modalState,
    setModalState,
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
    handleNaturesSanctuaryConfirm,
    handleCoronaEnemySelectionConfirm,
    handleRadianceOfDawnConfirm,
    handleMantleOfInspirationConfirm,
    handleVitalityOfTheTreeConfirm,
    handleInspiringSmiteConfirm,
    handleTricksterBlessingConfirm,
    handleBardicInspirationConfirm,
    handleInspiringMovementConfirm,
    handleOceanicGiftConfirm,
    handleDivineInterventionCast,
    pendingDamage,
    buildCtx,
    buildCtxSync,
    autoDamageContext,
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
    handleElderChampionRestore,
    handleRecklessAttackConfirm,
    handleRecklessAttackCancel,
    handleBrutalStrikeConfirm,
    handleBrutalStrikeCancel,
}) {
    const [combatSummary, setCombatSummary] = React.useState(null);

    useEffect(() => {
        getCombatContext(campaignName).then(cs => {
            if (cs) setCombatSummary(cs);
        });
    }, [campaignName]);

    return (
        <>
            {modalState.healingPoolModal && (
                <HealingPoolModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    name={modalState.healingPoolModal.name}
                    poolMax={modalState.healingPoolModal.pool}
                    poolExpression={modalState.healingPoolModal.poolExpression}
                    isDicePool={modalState.healingPoolModal.isDicePool}
                    dieType={modalState.healingPoolModal.dieType}
                    resourceKey={modalState.healingPoolModal.resourceKey}
                    alsoCures={modalState.healingPoolModal.alsoCures}
                    cureCost={modalState.healingPoolModal.cureCost}
                    bloodiedOnly={modalState.healingPoolModal.bloodiedOnly}
                    restoringTouchConditions={modalState.healingPoolModal.restoringTouchConditions}
                    maxDicePerUse={modalState.healingPoolModal.maxDicePerUse}
                    onClose={() => setModalState({ healingPoolModal: null })}
                />
            )}
            {modalState.handOfHealingModal && (
                <HandOfHealingModal
                    {...modalState.handOfHealingModal}
                    campaignName={campaignName}
                    onClose={() => setModalState({ handOfHealingModal: null })}
                />
            )}
            {modalState.fontOfMagicModal && (
                <FontOfMagicModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ fontOfMagicModal: null })}
                />
            )}
            {modalState.resourcePoolModal && (
                <ResourcePoolModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    automation={modalState.resourcePoolModal.automation}
                    onClose={() => setModalState({ resourcePoolModal: null })}
                />
            )}
            {modalState.moonlightStepResourceModal && (
                <MoonlightStepResourceModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    automation={modalState.moonlightStepResourceModal.automation}
                    onClose={() => setModalState({ moonlightStepResourceModal: null })}
                />
            )}
            {modalState.wildCompanionModal && (
                <WildCompanionModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ wildCompanionModal: null })}
                />
            )}
            {modalState.setConditionModal && (
                <SetConditionModal
                    {...modalState.setConditionModal}
                    characters={characters}
                    onClose={() => setModalState({ setConditionModal: null })}
                />
            )}
            {modalState.eyebiteEffectModal && (
                <EyebiteEffectModal
                    {...modalState.eyebiteEffectModal}
                    characters={characters}
                    onClose={() => setModalState({ eyebiteEffectModal: null })}
                />
            )}
            {modalState.attackRiderModal && (
                <AttackRiderModal
                    {...modalState.attackRiderModal}
                    onClose={async () => {
                        const modalAction = modalState.attackRiderModal?.action;
                        const modalPlayerStats = modalState.attackRiderModal?.playerStats;
                        const modalCampaignName = modalState.attackRiderModal?.campaignName;
                        setModalState({ attackRiderModal: null });
                        window.dispatchEvent(new CustomEvent('target-effects-updated'));
                        if (modalAction?.name === "Stalker's Flurry") {
                            const optKey = `_${modalAction.name.replace(/\s+/g, '_')}_option`;
                            const chosen = getRuntimeValue(modalPlayerStats.name, optKey, modalCampaignName);
                            if (!chosen) {
                                const skipKey = `_${modalAction.name.replace(/\s+/g, '_')}_skippedRound`;
                                await setSkipFlag(skipKey, modalPlayerStats, modalCampaignName);
                            }
                        }
                        const isCunningStrikeVariant = ['Cunning Strike', 'Improved Cunning Strike', 'Devious Strikes'].includes(modalAction?.name);
                        if (isCunningStrikeVariant) {
                            const costUsed = getRuntimeValue(modalPlayerStats.name, '_cunningStrikeCostUsed', modalCampaignName);
                            if (!costUsed || costUsed === 0) {
                                if (autoDamageContext?.current) {
                                    const ctx = autoDamageContext.current;
                                    const sneakAttackDice = ctx.sneakAttackDice || 0;
                                    let formula = ctx.formula;
                                    let total = ctx.total;
                                    let rolls = ctx.rolls;
                                    if (sneakAttackDice > 0) {
                                        const sneakFormula = `${sneakAttackDice}d6`;
                                        const sneakResult = ctx.context?.isAutoCrit ? rollExpressionDoubled(sneakFormula) : rollExpression(sneakFormula);
                                        if (sneakResult) {
                                            formula += ` + ${sneakFormula} [Sneak Attack]`;
                                            total += sneakResult.total;
                                            rolls = [...rolls, ...sneakResult.rolls];
                                        }
                                    }
                                    setPopupHtml(null);
                                    rollDamage(ctx.attackName, formula, total, rolls, ctx.modifier, ctx.context);
                                    autoDamageContext.current = null;
                                }
                            } else if (autoDamageContext) {
                                const ctx = autoDamageContext.current;
                                if (ctx) {
                                    const cunningStrikeCost = Number(getRuntimeValue(modalPlayerStats.name, '_cunningStrikeCostUsed', modalCampaignName) ?? 0);
                                    const effectiveSneakDice = Math.max(0, ctx.sneakAttackDice - cunningStrikeCost);
                                    let formula = ctx.formula;
                                    let total = ctx.total;
                                    let rolls = ctx.rolls;
                                    if (effectiveSneakDice > 0) {
                                        const sneakFormula = `${effectiveSneakDice}d6`;
                                        const sneakResult = ctx.context?.isAutoCrit ? rollExpressionDoubled(sneakFormula) : rollExpression(sneakFormula);
                                        if (sneakResult) {
                                            formula += ` + ${sneakFormula} [Sneak Attack]`;
                                            total += sneakResult.total;
                                            rolls = [...rolls, ...sneakResult.rolls];
                                        }
                                    }
                                    setPopupHtml(null);
                                    rollDamage(ctx.attackName, formula, total, rolls, ctx.modifier, ctx.context);
                                    autoDamageContext.current = null;
                                }
                            } else if (pendingDamage?._cunningStrike) {
                                const pending = pendingDamage;
                                const { attack } = pending;
                                pendingDamage = null;
                                (mapName ? buildCtx(attack) : buildCtxSync(attack)).then(ctx => {
                                    const sneakAttackDice = ctx?.sneakAttackDice || 0;
                                    const cunningStrikeCost = Number(getRuntimeValue(playerStats.name, '_cunningStrikeCostUsed', campaignName) ?? 0);
                                    const effectiveSneakDice = Math.max(0, sneakAttackDice - cunningStrikeCost);
                                    const wasCrit = pending.popupHtml?.isCrit;
                                    const baseResult = rollExpression(attack.damage);
                                    if (!baseResult) return;
                                    let formula = attack.damage;
                                    let total = baseResult.total;
                                    let rolls = baseResult.rolls;
                                    const modifier = baseResult.modifier;
                                    if (effectiveSneakDice > 0) {
                                        const sneakFormula = `${effectiveSneakDice}d6`;
                                        const sneakResult = wasCrit ? rollExpressionDoubled(sneakFormula) : rollExpression(sneakFormula);
                                        if (sneakResult) {
                                            formula += ` + ${sneakFormula} [Sneak Attack]`;
                                            total += sneakResult.total;
                                            rolls = [...rolls, ...sneakResult.rolls];
                                        }
                                    }
                                    setPopupHtml(null);
                                    rollDamage(attack.name, formula, total, rolls, modifier, ctx);
                                }).catch((e) => { console.error("[CharActionModals] Error:", e); });
                            }
                        }
                    }}
                />
            )}
            {modalState.openHandTechniqueModal && (
                <OpenHandTechniqueModal
                    {...modalState.openHandTechniqueModal}
                    onClose={() => { setModalState({ openHandTechniqueModal: null }); window.dispatchEvent(new CustomEvent('target-effects-updated')); window.dispatchEvent(new CustomEvent('combat-summary-updated')); }}
                />
            )}
            {modalState.weaponMasteryModal && (
                <WeaponMasteryModal
                    {...modalState.weaponMasteryModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    targetName={null}
                    onClose={handleMasteryClose}
                />
            )}
            {modalState.weaponMasteryChoiceModal && (
                <WeaponMasteryChoiceModal
                    {...modalState.weaponMasteryChoiceModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => { setModalState({ weaponMasteryChoiceModal: null }); }}
                    onConfirm={handleWeaponMasteryChoice}
                />
            )}
            {modalState.weaponKindMasteryModal && (
                <WeaponKindMasteryModal
                    {...modalState.weaponKindMasteryModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={handleWeaponKindMasteryClose}
                />
            )}
            {modalState.combatStanceModal && (
                <CombatStanceModal
                    {...modalState.combatStanceModal}
                    onClose={() => { setModalState({ combatStanceModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {modalState.revelationInFleshModal && (
                <RevelationInFleshModal
                    {...modalState.revelationInFleshModal}
                    onClose={() => { setModalState({ revelationInFleshModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {modalState.bastionOfLawModal && (
                <BastionOfLawModal
                    {...modalState.bastionOfLawModal}
                    campaignName={campaignName}
                    onConfirm={async (spAmount, targetName, diceToSpend, clearWard) => {
                        if (clearWard) {
                            const action = { name: modalState.bastionOfLawModal.featureName, automation: modalState.bastionOfLawModal.auto };
                            return await handleClearWard(action, playerStats, campaignName);
                        }
                        if (diceToSpend !== undefined && diceToSpend !== null) {
                            const action = { name: modalState.bastionOfLawModal.featureName, automation: modalState.bastionOfLawModal.auto };
                            return await handleSpendDice(action, playerStats, campaignName, diceToSpend);
                        }
                        const action = { name: modalState.bastionOfLawModal.featureName, automation: modalState.bastionOfLawModal.auto };
                        return await handleApply(action, playerStats, campaignName, spAmount, targetName);
                    }}
                    onClose={() => setModalState({ bastionOfLawModal: null })}
                />
            )}
            {modalState.teleportModal && (
                <TeleportModal
                    {...modalState.teleportModal}
                    onClose={() => { setModalState({ teleportModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    isMoonlightStep={modalState.teleportModal.action?.automation?.effect === 'moonlight_step_teleport'}
                />
            )}
            {modalState.moonlightStepFallbackModal && (
                <div className="sp-overlay" onClick={() => setModalState({ moonlightStepFallbackModal: null })}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-moon"></i> {modalState.moonlightStepFallbackModal.action.name}
                        </div>
                        <div className="sp-body">
                            <p>No Moonlight Step uses remaining. Consume a level {modalState.moonlightStepFallbackModal.slotLevel} spell slot to use Moonlight Step?</p>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-roll-btn" onClick={async () => {
                                const { action, playerStats: fallbackStats, campaignName: fallbackCampaign, slotLevel } = modalState.moonlightStepFallbackModal;
                                setModalState({ moonlightStepFallbackModal: null });
                                const res = await confirmTeleport(action, fallbackStats, fallbackCampaign, false, slotLevel);
                                if (res?.type === 'popup') {
                                    const payload = res.payload;
                                    const html = `<b>${payload.name || action.name}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
                                    setPopupHtml(html);
                                }
                            }}>
                                <i className="fa-solid fa-check"></i> Yes, Consume Slot
                            </button>
                            <button className="sp-dismiss-btn" onClick={() => setModalState({ moonlightStepFallbackModal: null })}>
                                <i className="fa-solid fa-times"></i> No
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {modalState.healingIllusionModal && (
                <SecondaryTargetModal
                    title="Healing Illusion"
                    targets={buildHealingIllusionTargets(playerStats, characters, combatSummary)}
                    description={`The illusion has ended. Choose a creature within 5 feet to regain ${playerStats.level || 1} HP:`}
                    onTargetSelected={(targetName) => handleHealingIllusionConfirm(targetName, modalState.healingIllusionModal, characters, campaignName, combatSummary, () => { setModalState({ healingIllusionModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); })}
                    onSkip={() => { setModalState({ healingIllusionModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                    confirmLabel="Heal"
                    confirmIcon="fa-heart"
                    showHp={true}
                    showSize={false}
                />
            )}
            {modalState.invokeDuplicityModal && (
                <CreatureSelectionModal
                    title="Improved Duplicity — Choose Allies"
                    icon="fa-people-arrows"
                    targets={buildInvokeDuplicityTargets(playerStats, characters, combatSummary)}
                    description="When you and your illusion are within 5 feet of a creature, your allies have Advantage on attack rolls against that creature."
                    note="Select all allies who should gain Advantage from the Improved Duplicity."
                    confirmLabel="Grant Advantage"
                    confirmIcon="fa-shield-halved"
                    onConfirm={(selected) => handleInvokeDuplicityConfirm(selected, modalState.invokeDuplicityModal, campaignName, () => { setModalState({ invokeDuplicityModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); })}
                    onSkip={() => { setModalState({ invokeDuplicityModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {modalState.saveAttackHealModal && (
                <SaveAttackHealModal
                    {...modalState.saveAttackHealModal}
                    onClose={() => setModalState({ saveAttackHealModal: null })}
                />
            )}
            {modalState.saveAttackAoeModal && (
                <SaveAttackAoeModal
                    {...modalState.saveAttackAoeModal}
                    onClose={() => setModalState({ saveAttackAoeModal: null })}
                />
            )}
            {modalState.divineSparkModal && (
                <DivineSparkModal
                    {...modalState.divineSparkModal}
                    playerStats={playerStats}
                    onClose={() => setModalState({ divineSparkModal: null })}
                />
            )}
            {modalState.divineInterventionModal && (
                <DivineInterventionModal
                    {...modalState.divineInterventionModal}
                    onSelect={handleDivineInterventionCast}
                    onClose={() => {
                        setModalState({ divineInterventionModal: null, divineInterventionAction: null });
                    }}
                />
            )}
            {modalState.arcaneChargeModal && (
                <ArcaneChargeModal
                    {...modalState.arcaneChargeModal}
                    onClose={() => setModalState({ arcaneChargeModal: null })}
                />
            )}
            {modalState.warMagicCantripModal && (
                <WarMagicCantripModal
                    {...modalState.warMagicCantripModal}
                    onClose={() => setModalState({ warMagicCantripModal: null })}
                />
            )}
            {modalState.warMagicSpellModal && (
                <WarMagicSpellModal
                    {...modalState.warMagicSpellModal}
                    onClose={() => setModalState({ warMagicSpellModal: null })}
                />
            )}
            {modalState.sacredWeaponModal && (
                <SacredWeaponModal
                    {...modalState.sacredWeaponModal}
                    onClose={() => setModalState({ sacredWeaponModal: null })}
                />
            )}
            {modalState.elderChampionRestoreModal && (
                <ElderChampionRestoreModal
                    action={modalState.elderChampionRestoreModal.payload.action}
                    playerStats={modalState.elderChampionRestoreModal.payload.playerStats}
                    campaignName={modalState.elderChampionRestoreModal.payload.campaignName}
                    onConfirm={() => {
                        handleElderChampionRestore(modalState.elderChampionRestoreModal.payload);
                        setModalState({ elderChampionRestoreModal: null });
                    }}
                    onClose={() => setModalState({ elderChampionRestoreModal: null })}
                />
            )}
            {modalState.primalCompanionBonusActionModal && (
                <PrimalCompanionBonusActionModal
                    {...modalState.primalCompanionBonusActionModal}
                    onClose={() => setModalState({ primalCompanionBonusActionModal: null })}
                />
            )}
            {modalState.mistyWandererModal && (
                <MistyWandererModal
                    {...modalState.mistyWandererModal}
                    onClose={() => setModalState({ mistyWandererModal: null })}
                />
            )}
            {modalState.feyReinforcementsModal && (
                <FeyReinforcementsModal
                    {...modalState.feyReinforcementsModal}
                    onClose={() => setModalState({ feyReinforcementsModal: null })}
                />
            )}
            {modalState.bonusActionChoiceModal && (
                <BonusActionChoiceModal
                    action={modalState.bonusActionChoiceModal.action}
                    options={modalState.bonusActionChoiceModal.options}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ bonusActionChoiceModal: null })}
                />
            )}
            {modalState.stealthAttackModal && (
                <StealthAttackModal
                    {...modalState.stealthAttackModal}
                    onClose={() => setModalState({ stealthAttackModal: null })}
                />
            )}
            {modalState.elementalAffinityModal && (
                <ElementalAffinityModal
                    {...modalState.elementalAffinityModal}
                    onClose={() => setModalState({ elementalAffinityModal: null })}
                />
            )}
            {modalState.fiendishResilienceModal && (
                <FiendishResilienceModal
                    {...modalState.fiendishResilienceModal}
                    onClose={() => setModalState({ fiendishResilienceModal: null })}
                />
            )}
            {modalState.dragonCompanionModal && (
                <DragonCompanionModal
                    {...modalState.dragonCompanionModal}
                    onClose={() => setModalState({ dragonCompanionModal: null })}
                />
            )}
            {modalState.wildMagicDoubleRollModal && (
                <WildMagicDoubleRollModal
                    {...modalState.wildMagicDoubleRollModal}
                    onClose={() => setModalState({ wildMagicDoubleRollModal: null })}
                />
            )}
            {modalState.wildMagicTamedModal && (
                <WildMagicTamedModal
                    {...modalState.wildMagicTamedModal}
                    onClose={() => setModalState({ wildMagicTamedModal: null })}
                />
            )}
            {modalState.thirdEyeModal && (
                <ThirdEyeModal
                    action={modalState.thirdEyeModal.action}
                    playerStats={modalState.thirdEyeModal.playerStats}
                    campaignName={modalState.thirdEyeModal.campaignName}
                    onClose={() => setModalState({ thirdEyeModal: null })}
                />
            )}
            {modalState.soulstitchSpellsModal && (
                <SoulstitchSpellsModal
                    {...modalState.soulstitchSpellsModal}
                    onClose={() => setModalState({ soulstitchSpellsModal: null })}
                />
            )}
            {modalState.illusoryRealityModal && (
                <IllusoryRealityModal
                    {...modalState.illusoryRealityModal}
                    onClose={() => setModalState({ illusoryRealityModal: null })}
                />
            )}
            {modalState.celestialRevelationModal && (
                <CelestialRevelationModal
                    {...modalState.celestialRevelationModal}
                    onClose={() => setModalState({ celestialRevelationModal: null })}
                    onSetConditionModal={setModalState}
                />
            )}
            {modalState.fiendishLegacyModal && (
                <FiendishLegacyModal
                    {...modalState.fiendishLegacyModal}
                    onClose={() => setModalState({ fiendishLegacyModal: null })}
                />
            )}
            {modalState.breathWeaponShapeModal && (
                <BreathWeaponShapeModal
                    {...modalState.breathWeaponShapeModal}
                    onClose={() => setModalState({ breathWeaponShapeModal: null })}
                />
            )}
            {modalState.hypnoticPatternShakeModal && (
                <HypnoticPatternShakeModal
                    {...modalState.hypnoticPatternShakeModal}
                    onClose={() => setModalState({ hypnoticPatternShakeModal: null })}
                />
            )}
            {modalState.arcaneWardRestoreModal && (
                <ArcaneWardRestoreModal
                    {...modalState.arcaneWardRestoreModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ arcaneWardRestoreModal: null })}
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
            {modalState.attackRiderManeuverPrompt && (
                <AttackRiderManeuverPrompt
                    maneuvers={modalState.attackRiderManeuverPrompt.maneuvers}
                    attack={modalState.attackRiderManeuverPrompt.attack}
                    popupHtml={modalState.attackRiderManeuverPrompt.popupHtml}
                    isMiss={modalState.attackRiderManeuverPrompt.isMiss}
                    onUse={handleAttackRiderManeuverUse}
                    onSkip={handleAttackRiderManeuverSkip}
                />
            )}
            {modalState.attackRiderOptionsModal && (
                <div className="sp-overlay" onClick={() => setModalState({ attackRiderOptionsModal: null })}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {modalState.attackRiderOptionsModal.maneuver.name} — Choose Effect
                        </div>
                        <div className="sp-body">
                            <p>Select the effect to apply:</p>
                            <div style={{ textAlign: 'left', marginTop: '12px' }}>
                                {modalState.attackRiderOptionsModal.riderOptions.map((opt, i) => (
                                    <label
                                        key={i}
                                        style={{
                                            display: 'block', padding: '8px 12px', margin: '4px 0',
                                            borderRadius: '6px', cursor: 'pointer',
                                            background: 'transparent',
                                            border: '1px solid var(--color-link)',
                                        }}
                                        onClick={() => handleAttackRiderOptionSelect(opt.name, modalState.attackRiderOptionsModal)}
                                    >
                                        <strong>{opt.name}</strong>
                                        {opt.effect === 'disadvantage_on_next_save' && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— Target has Disadvantage on next saving throw</span>}
                                        {opt.effect === 'next_attack_bonus' && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— Next attack against target gains +5 bonus</span>}
                                        {opt.effect === 'push_15ft' && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— Push target 15 feet</span>}
                                        {opt.effect === 'speed_reduction' && <span style={{ opacity: 0.7, marginLeft: '6px', fontSize: '0.85em' }}>— Reduce target's speed by 15 feet</span>}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={() => setModalState({ attackRiderOptionsModal: null })}>Skip</button>
                        </div>
                    </div>
                </div>
            )}
            {modalState.sweepingAttackTargetModal && (
                <SecondaryTargetModal
                    title="Sweeping Attack"
                    targets={modalState.sweepingAttackTargetModal.secondaryTargets}
                    description={`Choose a creature within 5 feet of ${modalState.sweepingAttackTargetModal.primaryTarget} to take ${modalState.sweepingAttackTargetModal.dieValue} damage:`}
                    onTargetSelected={(targetName) => handleSweepingAttackConfirm(targetName, modalState.sweepingAttackTargetModal)}
                    onSkip={() => setModalState({ sweepingAttackTargetModal: null })}
                    confirmLabel="Apply Sweeping Attack"
                    confirmIcon="fa-bolt"
                    showSize={true}
                />
            )}
            {modalState.baitAndSwitchChoiceModal && (
                <SecondaryTargetModal
                    title="Bait and Switch — AC Bonus"
                    targets={modalState.baitAndSwitchChoiceModal.options}
                    description={modalState.baitAndSwitchChoiceModal.description}
                    onTargetSelected={(targetName) => handleBaitAndSwitchChoiceConfirm(targetName, modalState.baitAndSwitchChoiceModal)}
                    onSkip={() => setModalState({ baitAndSwitchChoiceModal: null })}
                    confirmLabel="Apply AC Bonus"
                    confirmIcon="fa-check"
                />
            )}
            {modalState.commanderStrikeChoiceModal && (
                <SecondaryTargetModal
                    title="Commander's Strike — Ally Attack"
                    targets={modalState.commanderStrikeChoiceModal.options}
                    description={modalState.commanderStrikeChoiceModal.description}
                    onTargetSelected={(targetName) => handleCommanderStrikeChoiceConfirm(targetName, modalState.commanderStrikeChoiceModal)}
                    onSkip={() => setModalState({ commanderStrikeChoiceModal: null })}
                    confirmLabel="Grant Attack"
                    confirmIcon="fa-check"
                />
            )}
            {modalState.rallyChoiceModal && (
                <SecondaryTargetModal
                    title="Rally"
                    targets={modalState.rallyChoiceModal.allyOptions}
                    description={modalState.rallyChoiceModal.description}
                    onTargetSelected={(targetName) => handleRallyChoiceConfirm(targetName, modalState.rallyChoiceModal)}
                    onSkip={() => setModalState({ rallyChoiceModal: null })}
                    confirmLabel="Grant Temp HP"
                    confirmIcon="fa-heart"
                />
            )}
            {modalState.divineFuryChoice && (
                <div className="sp-overlay" onClick={() => handleDivineFurySkip()}>
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
            {modalState.damageTypeChoice && (
                <div className="sp-overlay" onClick={() => {
                    if (pendingDamage?._attackRider) handleEnhancedUnarmedSkip();
                    else if (pendingDamage?._damageTypeModifier) handleDamageTypeModifierSkip();
                    else handleGenericDamageTypeSkip();
                }}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {modalState.damageTypeChoice.title}
                        </div>
                        <div className="sp-body">
                            <p>Choose the damage type for this hit:</p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {modalState.damageTypeChoice.types.map((type) => (
                                    <button
                                        key={type}
                                        className="sp-roll-btn"
                                        style={{ margin: '0 6px 8px 6px' }}
                                        onClick={() => {
                                            if (pendingDamage?._attackRider) handleEnhancedUnarmedChoice(type);
                                            else if (pendingDamage?._damageTypeModifier) handleDamageTypeModifierChoice(type);
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
                                if (pendingDamage?._attackRider) handleEnhancedUnarmedSkip();
                                else if (pendingDamage?._damageTypeModifier) handleDamageTypeModifierSkip();
                                else handleGenericDamageTypeSkip();
                            }}>Skip</button>
                        </div>
                    </div>
                </div>
            )}
            {modalState.featureChoice && (
                <div className="sp-overlay" onClick={handleFeatureChoiceSkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {modalState.featureChoice.action.name}
                        </div>
                        <div className="sp-body">
                            <p><b>Choose your option:</b></p>
                            <p style={{ opacity: 0.8, fontSize: '0.9em' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(modalState.featureChoice.action.description) }}></p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {modalState.featureChoice.options.map((opt, i) => {
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
            {modalState.starryFormConstellationModal && (
                <ConstellationSelectionModal
                    action={modalState.starryFormConstellationModal.payload.action}
                    playerStats={modalState.starryFormConstellationModal.payload.playerStats}
                    campaignName={modalState.starryFormConstellationModal.payload.campaignName}
                    isTwinkled={false}
                    onConfirm={(option) => handleConstellationSelect(modalState.starryFormConstellationModal.payload, option)}
                    onClose={() => setModalState({ starryFormConstellationModal: null })}
                />
            )}
            {modalState.twinklingConstellationModal && (
                <ConstellationSelectionModal
                    action={modalState.twinklingConstellationModal.payload.action}
                    playerStats={modalState.twinklingConstellationModal.payload.playerStats}
                    campaignName={modalState.twinklingConstellationModal.payload.campaignName}
                    isTwinkled={true}
                    onConfirm={(option) => handleConstellationSelect(modalState.twinklingConstellationModal.payload, option)}
                    onClose={() => setModalState({ twinklingConstellationModal: null })}
                />
            )}
            {modalState.bulwarkOfForceModal && (
                <BulwarkOfForceModal
                    targets={modalState.bulwarkOfForceModal.creatureTargets}
                    maxTargets={modalState.bulwarkOfForceModal.maxTargets}
                    onConfirm={handleBulwarkOfForceConfirm}
                    onSkip={() => setModalState({ bulwarkOfForceModal: null })}
                />
            )}
            {modalState.zealousPresenceModal && (
                <ZealousPresenceModal
                    targets={modalState.zealousPresenceModal.creatureTargets}
                    maxTargets={modalState.zealousPresenceModal.maxTargets}
                    onConfirm={handleZealousPresenceConfirm}
                    onSkip={() => setModalState({ zealousPresenceModal: null })}
                />
            )}
            {modalState.naturesSanctuaryCreaturesModal && (
                <CreatureSelectionModal
                    title={modalState.naturesSanctuaryCreaturesModal.isMove ? "Nature's Sanctuary (Move) — Choose Creatures" : "Nature's Sanctuary — Choose Creatures"}
                    icon="fa-tree"
                    targets={modalState.naturesSanctuaryCreaturesModal.creatureTargets}
                    description="Select creatures to include in the sanctuary. Creatures in the sanctuary gain Half Cover and resistance to your Nature's Ward damage type."
                    note={modalState.naturesSanctuaryCreaturesModal.isMove ? "Existing creatures are pre-selected. Toggle to add or remove creatures." : "Expend 1 Wild Shape use to create the sanctuary."}
                    confirmLabel={modalState.naturesSanctuaryCreaturesModal.isMove ? "Move Sanctuary" : "Create Sanctuary"}
                    confirmIcon="fa-tree"
                    defaultSelected={modalState.naturesSanctuaryCreaturesModal.defaultSelected}
                    onConfirm={handleNaturesSanctuaryConfirm}
                    onSkip={() => setModalState({ naturesSanctuaryCreaturesModal: null })}
                />
            )}
            {modalState.coronaEnemySelectionModal && (
                <CoronaEnemySelectionModal
                    creatureTargets={modalState.coronaEnemySelectionModal.creatureTargets}
                    onConfirm={handleCoronaEnemySelectionConfirm}
                    onSkip={() => setModalState({ coronaEnemySelectionModal: null })}
                />
            )}
            {modalState.radianceOfDawnModal && (
                <RadianceOfDawnModal
                    creatureTargets={modalState.radianceOfDawnModal.creatureTargets}
                    saveType={modalState.radianceOfDawnModal.saveType}
                    saveDc={modalState.radianceOfDawnModal.saveDc}
                    damageExpression={modalState.radianceOfDawnModal.damageExpression}
                    damageType={modalState.radianceOfDawnModal.damageType}
                    rangeFeet={modalState.radianceOfDawnModal.rangeFeet}
                    onConfirm={handleRadianceOfDawnConfirm}
                    onSkip={() => setModalState({ radianceOfDawnModal: null })}
                />
            )}
            {modalState.mantleOfInspirationTarget && (
                <MantleOfInspirationModal
                    creatureTargets={modalState.mantleOfInspirationTarget.creatureTargets}
                    tempHp={modalState.mantleOfInspirationTarget.tempHp}
                    dieRoll={modalState.mantleOfInspirationTarget.dieRoll}
                    bardicDieSize={modalState.mantleOfInspirationTarget.bardicDieSize}
                    maxTargets={modalState.mantleOfInspirationTarget.maxTargets}
                    onConfirm={handleMantleOfInspirationConfirm}
                    onSkip={() => setModalState({ mantleOfInspirationTarget: null })}
                />
            )}
            {modalState.vitalityOfTheTreeTarget && (
                <VitalityOfTheTreeModal
                    creatureTargets={modalState.vitalityOfTheTreeTarget.creatureTargets}
                    tempHp={modalState.vitalityOfTheTreeTarget.tempHp}
                    maxTargets={modalState.vitalityOfTheTreeTarget.maxTargets}
                    onConfirm={handleVitalityOfTheTreeConfirm}
                    onSkip={() => setModalState({ vitalityOfTheTreeTarget: null })}
                />
            )}
            {modalState.inspiringSmiteModal && (
                <InspiringSmiteModal
                    creatureTargets={modalState.inspiringSmiteModal.creatureTargets}
                    tempHp={modalState.inspiringSmiteModal.tempHp}
                    roll={modalState.inspiringSmiteModal.roll}
                    onConfirm={handleInspiringSmiteConfirm}
                    onSkip={() => setModalState({ inspiringSmiteModal: null })}
                />
            )}
            {modalState.tricksterBlessingModal && (
                <SecondaryTargetModal
                    title="Blessing of the Trickster — Choose Target"
                    targets={modalState.tricksterBlessingModal.creatureTargets}
                    confirmLabel="Grant Blessing"
                    confirmIcon="fa-hands"
                    showHp={false}
                    onTargetSelected={handleTricksterBlessingConfirm}
                    onSkip={() => handleTricksterBlessingConfirm(null)}
                />
            )}
            {modalState.bardicInspirationTargetModal && (
                <SecondaryTargetModal
                    title="Bardic Inspiration — Choose Target"
                    targets={modalState.bardicInspirationTargetModal.creatureTargets}
                    confirmLabel="Grant Inspiration"
                    confirmIcon="fa-music"
                    description={`Grant a Bardic Inspiration die (d${modalState.bardicInspirationTargetModal.dieSize}) to the target. The creature can roll it on one ability check.`}
                    showHp={false}
                    onTargetSelected={handleBardicInspirationConfirm}
                    onSkip={() => handleBardicInspirationConfirm(null)}
                />
            )}
            {modalState.inspiringMovementAllyModal && (
                <SecondaryTargetModal
                    title="Inspiring Movement — Choose Ally"
                    targets={modalState.inspiringMovementAllyModal.creatureTargets}
                    confirmLabel="Move"
                    confirmIcon="fa-person-walking"
                    featureDescription="Both you and the chosen ally move up to half your Speeds without provoking Opportunity Attacks."
                    onTargetSelected={handleInspiringMovementConfirm}
                    onSkip={() => handleInspiringMovementConfirm(null)}
                />
            )}
            {modalState.oceanicGiftTargetModal && (
                <SecondaryTargetModal
                    title={modalState.oceanicGiftTargetModal.doubleEmanation ? "Oceanic Gift — Choose Ally (Self + Ally, 2 Wild Shape)" : "Oceanic Gift — Choose Ally"}
                    targets={modalState.oceanicGiftTargetModal.creatureTargets}
                    confirmLabel="Grant Wrath of the Sea"
                    confirmIcon="fa-water"
                    featureDescription={modalState.oceanicGiftTargetModal.doubleEmanation
                        ? "Manifest the Emanation around both yourself and the chosen ally. Costs 2 Wild Shape uses."
                        : "Manifest the Emanation around one willing creature within 60 feet. Costs 1 Wild Shape."
                    }
                    onTargetSelected={(targetName) => handleOceanicGiftConfirm(targetName)}
                    onSkip={() => handleOceanicGiftConfirm(null)}
                />
            )}
            {modalState.recklessAttackModal && (
                <RecklessAttackModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    attack={modalState.recklessAttackModal.attack}
                    mode={modalState.recklessAttackModal.mode || 'full'}
                    hasBrutalStrike={modalState.recklessAttackModal.hasBrutalStrike || false}
                    brutalStrikeOptions={modalState.recklessAttackModal.brutalStrikeOptions || []}
                    maxEffects={modalState.recklessAttackModal.maxEffects || 1}
                    onConfirm={modalState.recklessAttackModal.mode === 'brutalOnly'
                        ? (choice) => handleBrutalStrikeConfirm(choice)
                        : (attack, choice) => handleRecklessAttackConfirm(attack, choice)}
                    onCancel={modalState.recklessAttackModal.mode === 'brutalOnly'
                        ? (choice) => handleBrutalStrikeCancel(choice)
                        : () => handleRecklessAttackCancel(modalState.recklessAttackModal.attack)}
                />
            )}
        </>
    )
}
