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
import PrimalCompanionBonusActionModal from './modals/PrimalCompanionBonusActionModal.jsx'
import MistyWandererModal from './modals/MistyWandererModal.jsx'
import FeyReinforcementsModal from './modals/FeyReinforcementsModal.jsx'
import BonusActionChoiceModal from './modals/shared/BonusActionChoiceModal.jsx'
import RevelationInFleshModal from './modals/RevelationInFleshModal.jsx'
import ElementalAffinityModal from './modals/ElementalAffinityModal.jsx'
import FiendishResilienceModal from './modals/FiendishResilienceModal.jsx'
import DragonCompanionModal from './modals/DragonCompanionModal.jsx'
import WildMagicSurgeModal from './modals/WildMagicSurgeModal.jsx'
import BendFateModal from './modals/BendFateModal.jsx'
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
import MassHealModal from './modals/MassHealModal.jsx'
import MassCureWoundsModal from './modals/MassCureWoundsModal.jsx'
import PrayerOfHealingModal from './modals/PrayerOfHealingModal.jsx'
import PowerWordFortifyModal from './modals/PowerWordFortifyModal.jsx'
import MassHealingWordModal from './modals/MassHealingWordModal.jsx'
import { handleApply } from '../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js'
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
    spellModalState,
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
    handleRecklessAttackConfirm,
    handleRecklessAttackCancel,
    handleBrutalStrikeConfirm,
    handleBrutalStrikeCancel,
    handleMassHealConfirm,
    handleMassCureWoundsConfirm,
    handlePrayerOfHealingConfirm,
    handlePowerWordFortifyConfirm,
    handleMassHealingWordConfirm,
}) {
    const [combatSummary, setCombatSummary] = React.useState(null);
    const mergedModalState = React.useMemo(() => ({ ...modalState, ...spellModalState }), [modalState, spellModalState]);

    useEffect(() => {
        getCombatContext(campaignName).then(cs => {
            if (cs) setCombatSummary(cs);
        });
    }, [campaignName]);

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
                    onClose={async () => {
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
            {mergedModalState.openHandTechniqueModal && (
                <OpenHandTechniqueModal
                    {...mergedModalState.openHandTechniqueModal}
                    onClose={() => { setModalState({ openHandTechniqueModal: null }); window.dispatchEvent(new CustomEvent('target-effects-updated')); window.dispatchEvent(new CustomEvent('combat-summary-updated')); }}
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
            {mergedModalState.moonlightStepFallbackModal && (
                <div className="sp-overlay" onClick={() => setModalState({ moonlightStepFallbackModal: null })}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-moon"></i> {mergedModalState.moonlightStepFallbackModal.action.name}
                        </div>
                        <div className="sp-body">
                            <p>No Moonlight Step uses remaining. Consume a level {mergedModalState.moonlightStepFallbackModal.slotLevel} spell slot to use Moonlight Step?</p>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-roll-btn" onClick={async () => {
                                const { action, playerStats: fallbackStats, campaignName: fallbackCampaign, slotLevel } = mergedModalState.moonlightStepFallbackModal;
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
            {mergedModalState.healingIllusionModal && (
                <SecondaryTargetModal
                    title="Healing Illusion"
                    targets={buildHealingIllusionTargets(playerStats, characters, combatSummary)}
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
                    targets={buildInvokeDuplicityTargets(playerStats, characters, combatSummary)}
                    description="When you and your illusion are within 5 feet of a creature, your allies have Advantage on attack rolls against that creature."
                    note="Select all allies who should gain Advantage from the Improved Duplicity."
                    confirmLabel="Grant Advantage"
                    confirmIcon="fa-shield-halved"
                    onConfirm={(selected) => handleInvokeDuplicityConfirm(selected, mergedModalState.invokeDuplicityModal, campaignName, () => { setModalState({ invokeDuplicityModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); })}
                    onSkip={() => { setModalState({ invokeDuplicityModal: null }); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
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
            {mergedModalState.sacredWeaponModal && (
                <SacredWeaponModal
                    {...mergedModalState.sacredWeaponModal}
                    onClose={() => setModalState({ sacredWeaponModal: null })}
                />
            )}
            {mergedModalState.primalCompanionBonusActionModal && (
                <PrimalCompanionBonusActionModal
                    {...mergedModalState.primalCompanionBonusActionModal}
                    onClose={() => setModalState({ primalCompanionBonusActionModal: null })}
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
            {mergedModalState.bonusActionChoiceModal && (
                <BonusActionChoiceModal
                    action={mergedModalState.bonusActionChoiceModal.action}
                    options={mergedModalState.bonusActionChoiceModal.options}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ bonusActionChoiceModal: null })}
                />
            )}
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
                <FiendishResilienceModal
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
            {mergedModalState.wildMagicSurgeModal && (
                <WildMagicSurgeModal
                    {...mergedModalState.wildMagicSurgeModal}
                    onClose={() => setModalState({ wildMagicSurgeModal: null })}
                />
            )}
            {mergedModalState.bendFateModal && (
                <BendFateModal
                    {...mergedModalState.bendFateModal}
                    onClose={() => setModalState({ bendFateModal: null })}
                />
            )}
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
            {mergedModalState.attackRiderOptionsModal && (
                <div className="sp-overlay" onClick={() => setModalState({ attackRiderOptionsModal: null })}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {mergedModalState.attackRiderOptionsModal.maneuver.name} — Choose Effect
                        </div>
                        <div className="sp-body">
                            <p>Select the effect to apply:</p>
                            <div style={{ textAlign: 'left', marginTop: '12px' }}>
                                {mergedModalState.attackRiderOptionsModal.riderOptions.map((opt, i) => (
                                    <label
                                        key={i}
                                        style={{
                                            display: 'block', padding: '8px 12px', margin: '4px 0',
                                            borderRadius: '6px', cursor: 'pointer',
                                            background: 'transparent',
                                            border: '1px solid var(--color-link)',
                                        }}
                                        onClick={() => handleAttackRiderOptionSelect(opt.name, mergedModalState.attackRiderOptionsModal)}
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
            {mergedModalState.sweepingAttackTargetModal && (
                <SecondaryTargetModal
                    title="Sweeping Attack"
                    targets={mergedModalState.sweepingAttackTargetModal.secondaryTargets}
                    description={`Choose a creature within 5 feet of ${mergedModalState.sweepingAttackTargetModal.primaryTarget} to take ${mergedModalState.sweepingAttackTargetModal.dieValue} damage:`}
                    onTargetSelected={(targetName) => handleSweepingAttackConfirm(targetName, mergedModalState.sweepingAttackTargetModal)}
                    onSkip={() => setModalState({ sweepingAttackTargetModal: null })}
                    confirmLabel="Apply Sweeping Attack"
                    confirmIcon="fa-bolt"
                    showSize={true}
                />
            )}
            {mergedModalState.baitAndSwitchChoiceModal && (
                <SecondaryTargetModal
                    title="Bait and Switch — AC Bonus"
                    targets={mergedModalState.baitAndSwitchChoiceModal.options}
                    description={mergedModalState.baitAndSwitchChoiceModal.description}
                    onTargetSelected={(targetName) => handleBaitAndSwitchChoiceConfirm(targetName, mergedModalState.baitAndSwitchChoiceModal)}
                    onSkip={() => setModalState({ baitAndSwitchChoiceModal: null })}
                    confirmLabel="Apply AC Bonus"
                    confirmIcon="fa-check"
                />
            )}
            {mergedModalState.commanderStrikeChoiceModal && (
                <SecondaryTargetModal
                    title="Commander's Strike — Ally Attack"
                    targets={mergedModalState.commanderStrikeChoiceModal.options}
                    description={mergedModalState.commanderStrikeChoiceModal.description}
                    onTargetSelected={(targetName) => handleCommanderStrikeChoiceConfirm(targetName, mergedModalState.commanderStrikeChoiceModal)}
                    onSkip={() => setModalState({ commanderStrikeChoiceModal: null })}
                    confirmLabel="Grant Attack"
                    confirmIcon="fa-check"
                />
            )}
            {mergedModalState.rallyChoiceModal && (
                <SecondaryTargetModal
                    title="Rally"
                    targets={mergedModalState.rallyChoiceModal.allyOptions}
                    description={mergedModalState.rallyChoiceModal.description}
                    onTargetSelected={(targetName) => handleRallyChoiceConfirm(targetName, mergedModalState.rallyChoiceModal)}
                    onSkip={() => setModalState({ rallyChoiceModal: null })}
                    confirmLabel="Grant Temp HP"
                    confirmIcon="fa-heart"
                />
            )}
            {mergedModalState.divineFuryChoice && (
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
            {mergedModalState.damageTypeChoice && (
                <div className="sp-overlay" onClick={() => {
                    if (pendingDamage?._attackRider) handleEnhancedUnarmedSkip();
                    else if (pendingDamage?._damageTypeModifier) handleDamageTypeModifierSkip();
                    else handleGenericDamageTypeSkip();
                }}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {mergedModalState.damageTypeChoice.title}
                        </div>
                        <div className="sp-body">
                            <p>Choose the damage type for this hit:</p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {mergedModalState.damageTypeChoice.types.map((type) => (
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
            {mergedModalState.featureChoice && (
                <div className="sp-overlay" onClick={handleFeatureChoiceSkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {mergedModalState.featureChoice.action.name}
                        </div>
                        <div className="sp-body">
                            <p><b>Choose your option:</b></p>
                            <p style={{ opacity: 0.8, fontSize: '0.9em' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(mergedModalState.featureChoice.action.description) }}></p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {mergedModalState.featureChoice.options.map((opt, i) => {
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
            {mergedModalState.starryFormConstellationModal && (
                <ConstellationSelectionModal
                    action={mergedModalState.starryFormConstellationModal.payload.action}
                    playerStats={mergedModalState.starryFormConstellationModal.payload.playerStats}
                    campaignName={mergedModalState.starryFormConstellationModal.payload.campaignName}
                    isTwinkled={false}
                    onConfirm={(option) => handleConstellationSelect(mergedModalState.starryFormConstellationModal.payload, option)}
                    onClose={() => setModalState({ starryFormConstellationModal: null })}
                />
            )}
            {mergedModalState.twinklingConstellationModal && (
                <ConstellationSelectionModal
                    action={mergedModalState.twinklingConstellationModal.payload.action}
                    playerStats={mergedModalState.twinklingConstellationModal.payload.playerStats}
                    campaignName={mergedModalState.twinklingConstellationModal.payload.campaignName}
                    isTwinkled={true}
                    onConfirm={(option) => handleConstellationSelect(mergedModalState.twinklingConstellationModal.payload, option)}
                    onClose={() => setModalState({ twinklingConstellationModal: null })}
                />
            )}
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
            {mergedModalState.naturesSanctuaryCreaturesModal && (
                <CreatureSelectionModal
                    title={mergedModalState.naturesSanctuaryCreaturesModal.isMove ? "Nature's Sanctuary (Move) — Choose Creatures" : "Nature's Sanctuary — Choose Creatures"}
                    icon="fa-tree"
                    targets={mergedModalState.naturesSanctuaryCreaturesModal.creatureTargets}
                    description="Select creatures to include in the sanctuary. Creatures in the sanctuary gain Half Cover and resistance to your Nature's Ward damage type."
                    note={mergedModalState.naturesSanctuaryCreaturesModal.isMove ? "Existing creatures are pre-selected. Toggle to add or remove creatures." : "Expend 1 Wild Shape use to create the sanctuary."}
                    confirmLabel={mergedModalState.naturesSanctuaryCreaturesModal.isMove ? "Move Sanctuary" : "Create Sanctuary"}
                    confirmIcon="fa-tree"
                    defaultSelected={mergedModalState.naturesSanctuaryCreaturesModal.defaultSelected}
                    onConfirm={handleNaturesSanctuaryConfirm}
                    onSkip={() => setModalState({ naturesSanctuaryCreaturesModal: null })}
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
            {mergedModalState.tricksterBlessingModal && (
                <SecondaryTargetModal
                    title="Blessing of the Trickster — Choose Target"
                    targets={mergedModalState.tricksterBlessingModal.creatureTargets}
                    confirmLabel="Grant Blessing"
                    confirmIcon="fa-hands"
                    showHp={false}
                    onTargetSelected={handleTricksterBlessingConfirm}
                    onSkip={() => handleTricksterBlessingConfirm(null)}
                />
            )}
            {mergedModalState.bardicInspirationTargetModal && (
                <SecondaryTargetModal
                    title="Bardic Inspiration — Choose Target"
                    targets={mergedModalState.bardicInspirationTargetModal.creatureTargets}
                    confirmLabel="Grant Inspiration"
                    confirmIcon="fa-music"
                    description={`Grant a Bardic Inspiration die (d${mergedModalState.bardicInspirationTargetModal.dieSize}) to the target. The creature can roll it on one ability check.`}
                    showHp={false}
                    onTargetSelected={handleBardicInspirationConfirm}
                    onSkip={() => handleBardicInspirationConfirm(null)}
                />
            )}
            {mergedModalState.inspiringMovementAllyModal && (
                <SecondaryTargetModal
                    title="Inspiring Movement — Choose Ally"
                    targets={mergedModalState.inspiringMovementAllyModal.creatureTargets}
                    confirmLabel="Move"
                    confirmIcon="fa-person-walking"
                    featureDescription="Both you and the chosen ally move up to half your Speeds without provoking Opportunity Attacks."
                    onTargetSelected={handleInspiringMovementConfirm}
                    onSkip={() => handleInspiringMovementConfirm(null)}
                />
            )}
            {mergedModalState.oceanicGiftTargetModal && (
                <SecondaryTargetModal
                    title={mergedModalState.oceanicGiftTargetModal.doubleEmanation ? "Oceanic Gift — Choose Ally (Self + Ally, 2 Wild Shape)" : "Oceanic Gift — Choose Ally"}
                    targets={mergedModalState.oceanicGiftTargetModal.creatureTargets}
                    confirmLabel="Grant Wrath of the Sea"
                    confirmIcon="fa-water"
                    featureDescription={mergedModalState.oceanicGiftTargetModal.doubleEmanation
                        ? "Manifest the Emanation around both yourself and the chosen ally. Costs 2 Wild Shape uses."
                        : "Manifest the Emanation around one willing creature within 60 feet. Costs 1 Wild Shape."
                    }
                    onTargetSelected={(targetName) => handleOceanicGiftConfirm(targetName)}
                    onSkip={() => handleOceanicGiftConfirm(null)}
                />
            )}
            {mergedModalState.recklessAttackModal && (
                <RecklessAttackModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    attack={mergedModalState.recklessAttackModal.attack}
                    mode={mergedModalState.recklessAttackModal.mode || 'full'}
                    hasBrutalStrike={mergedModalState.recklessAttackModal.hasBrutalStrike || false}
                    brutalStrikeOptions={mergedModalState.recklessAttackModal.brutalStrikeOptions || []}
                    maxEffects={mergedModalState.recklessAttackModal.maxEffects || 1}
                    onConfirm={mergedModalState.recklessAttackModal.mode === 'brutalOnly'
                        ? (choice) => handleBrutalStrikeConfirm(choice)
                        : (attack, choice) => handleRecklessAttackConfirm(attack, choice)}
                    onCancel={mergedModalState.recklessAttackModal.mode === 'brutalOnly'
                        ? (choice) => handleBrutalStrikeCancel(choice)
                        : () => handleRecklessAttackCancel(mergedModalState.recklessAttackModal.attack)}
                />
            )}
            {mergedModalState.massHealModal && (
                <MassHealModal
                    creatureTargets={mergedModalState.massHealModal.creatureTargets}
                    maxTargets={mergedModalState.massHealModal.maxTargets}
                    onConfirm={handleMassHealConfirm}
                    onSkip={() => setModalState({ massHealModal: null })}
                />
            )}
            {mergedModalState.massCureWoundsModal && (
                <MassCureWoundsModal
                    creatureTargets={mergedModalState.massCureWoundsModal.creatureTargets}
                    maxTargets={mergedModalState.massCureWoundsModal.maxTargets}
                    onConfirm={handleMassCureWoundsConfirm}
                    onSkip={() => setModalState({ massCureWoundsModal: null })}
                />
            )}
            {mergedModalState.prayerOfHealingModal && (
                <PrayerOfHealingModal
                    creatureTargets={mergedModalState.prayerOfHealingModal.creatureTargets}
                    maxTargets={mergedModalState.prayerOfHealingModal.maxTargets}
                    onConfirm={handlePrayerOfHealingConfirm}
                    onSkip={() => setModalState({ prayerOfHealingModal: null })}
                />
            )}
            {mergedModalState.powerWordFortifyModal && (
                <PowerWordFortifyModal
                    creatureTargets={mergedModalState.powerWordFortifyModal.creatureTargets}
                    maxTargets={mergedModalState.powerWordFortifyModal.maxTargets}
                    onConfirm={handlePowerWordFortifyConfirm}
                    onSkip={() => setModalState({ powerWordFortifyModal: null })}
                />
            )}
            {mergedModalState.massHealingWordModal && (
                <MassHealingWordModal
                    creatureTargets={mergedModalState.massHealingWordModal.creatureTargets}
                    maxTargets={mergedModalState.massHealingWordModal.maxTargets}
                    onConfirm={handleMassHealingWordConfirm}
                    onSkip={() => setModalState({ massHealingWordModal: null })}
                />
            )}
        </>
    )
}
