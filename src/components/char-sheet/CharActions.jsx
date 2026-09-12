import React, { useState, useEffect } from 'react'
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js'
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { getCategories } from '../../services/character/featureCategories.js'
import { getActionSpellNames, applyPotentSpellcasting } from '../../services/ui/spellSectionUtils.js'
import { formatRange, signFormatter, getAttackSpellLevel } from '../../services/ui/formatUtils.js'
import { resolveSpellDamageAtLevel, isAutoHitSpell, resolveHealExpression } from '../../services/rules/core/spellDamageUtils.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js'
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js'
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js'
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js'
import { computeFeatRangeEffects } from '../../services/character/featRangeService.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js'
import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { buildAttackContext, buildAttackContextSync } from '../../services/automation/contextBuilder.js';
import { getEmpoweredSpellDescription } from '../../services/rules/spells/empoweredSpellService.js';
import { useActionSpellMetamagic } from '../../hooks/combat/useActionSpellMetamagic.js';
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';
import { useSimpleDamageRoll } from '../../hooks/combat/useSimpleDamageRoll.js';
import { useSpellPositionResolver } from '../../hooks/combat/useSpellPositionResolver.js';
import { useSpellCastExecutor } from '../../hooks/combat/useSpellCastExecutor.js';
import { getWeaponMastery } from '../../services/combat/weaponMasteryUtils.js';
import { getTargetFromAttacker, getCombatContext, getAttackerTargetName } from '../../services/rules/combat/damageUtils.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import { executeHandler } from '../../services/automation/index.js';
import { addEntry } from '../../services/ui/logService.js';
import { toggleBuff } from '../../services/automation/common/buffToggle.js';
import { addExpiration } from '../../services/rules/effects/expirations.js';
import { createSaveListener } from '../../services/automation/common/savePrompt.js';
import CharActionModals from './CharActionModals.jsx';
import CharActionSpellPopups from './CharActionSpellPopups.jsx';
import CharBonusActions from './CharBonusActions.jsx';
import useCharActionModals from './useCharActionModals.js';
import useInitiativeEffects from './useInitiativeEffects.js';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';
import useCharActionsModalHandlers from './useCharActionsModalHandlers.js';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import useCharActionsEventListeners from './useCharActionsEventListeners.js';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import useCharActionsCleave from './useCharActionsCleave.js';
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx';
import TacticalMasterModal from './modals/TacticalMasterModal.jsx';
import { applyMasteryEffect } from '../../services/automation/handlers/combat/weaponMasteryHandler.js';
import { normalizeAutoDamage } from './useAttackDamageResolution.js';

import './CharActions.css'

function resolveActionSpellRow(spell, playerStats) {
    const damageType = typeof spell.damage === 'string' ? '' : (spell.damage?.damage_type || '');
    const resolvedDamage = spell.heal_at_slot_level
        ? resolveHealExpression(spell, playerStats.level, playerStats.spellAbilities?.modifier || 0)
        : resolveSpellDamageAtLevel(spell, playerStats.level);
    const autoHit = isAutoHitSpell(spell);
    const isSpellAtk = !spell.dc;
    const hasAttackType = spell.attack_type != null && spell.attack_type !== '';
    const attackItem = { ...spell, type: 'Action', hitBonus: playerStats.spellAbilities?.toHit, saveDc: spell.dc ? playerStats.spellAbilities.saveDc : null, saveType: spell.dc?.dc_type, saveSuccess: spell.dc?.dc_success, damage: resolvedDamage, damageType };
    return { damageType, resolvedDamage, autoHit, isSpellAtk, hasAttackType, attackItem };
}

function renderActionSpellHitCell({ autoHit, isSpellAtk, hasAttackType, cannotAct, conditionAttackMode, toHit, exhaustionPenalty, saveDc, displaySaveDcBonus, dcType, attackItem, handleSpellAttackClick }) {
    if (autoHit) return <div></div>;
    if (isSpellAtk) {
        if (!hasAttackType) return <div></div>;
        const penalized = exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? ' stat--penalized' : '';
        return <div className={"clickable" + penalized + (cannotAct ? ' disabled-attack' : '')} onClick={() => handleSpellAttackClick(attackItem)}>{signFormatter.format(toHit - exhaustionPenalty)}</div>;
    }
    return <div className="save-dc-display">DC {saveDc + displaySaveDcBonus} {dcType}</div>;
}

function renderActionSpellTypeCell(spell, damageType) {
    return <div className='left'>{damageType || (spell.heal_at_slot_level ? 'Healing' : 'Utility')}</div>;
}

function renderAutomationBadges(action, badgeSaveDc) {
    if (!hasAutomation(action)) return null;
    const auto = action.automation || {};
    const badges = [];
    if (auto.type === 'save_attack' && badgeSaveDc) badges.push(<span key="save-dc" className="automation-badge"> DC {badgeSaveDc} {auto.saveType}</span>);
    if (auto.type === 'healing_pool') badges.push(<span key="pool" className="automation-badge"> Pool: {auto.pool} HP</span>);
    if (auto.damage) badges.push(<span key="damage" className="automation-badge"> {auto.damage} {auto.damageType}</span>);
    return badges;
}

function renderFeatureActionRow(action, playerStats, handleAutomationAction, setPopupHtml) {
    const auto = action.automation;
    const isMetamagic = action.name === 'Metamagic' && auto?.type === 'spell_modifier';
    const isClickable = action.details || hasAutomation(action);
    const handleClick = () => {
        if (hasAutomation(action)) {
            handleAutomationAction(action);
        } else {
            setPopupHtml(buildFeatureDetailHtml(action));
        }
    };
    const displayName = isMetamagic ? 'Empowered Spell' : action.name;
    const displayDesc = isMetamagic ? getEmpoweredSpellDescription(action) : action.description;
    // Resolve 'ability' save DC placeholder to the caster's numeric spell save DC
    const badgeSaveDc = auto?.saveDc === 'ability' ? playerStats.spellAbilities?.saveDc : auto?.saveDc;
    return <div key={action.name}>
        <b className={isClickable ? "clickable" : ""} onClick={handleClick}>{displayName}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayDesc) }}></span>
        {renderAutomationBadges(action, badgeSaveDc)}
    </div>;
}

function PendingActionModalsHost({
    showCleaveTargetSelection, cleaveSecondTargets, handleCleaveAttack, setShowCleaveTargetSelection, setCleaveSecondTargets,
    tacticalMasterModal, handleTacticalMasterConfirm, handleTacticalMasterDismiss, resumeAttackPipeline,
    playerStats, campaignName, modalState,
}) {
    return (
        <>
            {showCleaveTargetSelection && (
                <SecondaryTargetModal
                    title="Cleave — Choose Second Target"
                    targets={cleaveSecondTargets}
                    onTargetSelected={handleCleaveAttack}
                    onSkip={() => { setShowCleaveTargetSelection(false); setCleaveSecondTargets([]); }}
                    featureDescription="On a hit, the second creature takes weapon damage (no ability modifier to damage unless negative). Once per turn."
                />
            )}
            {tacticalMasterModal && (
                <TacticalMasterModal
                    attackName={tacticalMasterModal.attackName}
                    baseMastery={tacticalMasterModal.baseMastery}
                    replaceOptions={tacticalMasterModal.replaceOptions}
                    targetName={tacticalMasterModal.targetName}
                    isChoiceMode={tacticalMasterModal.isChoiceMode}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onConfirm={async (chosenMastery) => { await handleTacticalMasterConfirm(chosenMastery); await resumeAttackPipeline(); }}
                    onClose={async () => { handleTacticalMasterDismiss(); await resumeAttackPipeline(); }}
                />
            )}
            {modalState.secondaryTargetModal && (
                <SecondaryTargetModal
                    title={modalState.secondaryTargetModal.title}
                    targets={modalState.secondaryTargetModal.targets}
                    onTargetSelected={modalState.secondaryTargetModal.onTargetSelected}
                    onSkip={modalState.secondaryTargetModal.onSkip}
                    featureDescription={modalState.secondaryTargetModal.featureDescription}
                    description={modalState.secondaryTargetModal.description}
                    confirmLabel={modalState.secondaryTargetModal.confirmLabel}
                />
            )}
        </>
    );
}

function getActionSpells(playerStats, campaignName) {
    const nameSet = getActionSpellNames(playerStats, campaignName);
    return (playerStats.spellAbilities?.spells || []).filter(spell => nameSet.has(spell.name));
}

function hasWeaponKindMastery(playerStats) {
    return (playerStats.automation?.passives || []).some(p => p.type === 'weapon_kind_mastery');
}

function renderCannotActLabel(cannotAct, cannotActReason) {
    if (!cannotAct) return null;
    return <span className='disabled-attack-label'>({cannotActReason || 'Incapacitated'})</span>;
}

function handleActionSpellDamageClick({ attackItem, spell, isSpellAtk, resolvedDamage, cannotAct, resolveSpellDamage, actionGateMetamagic }) {
    if (cannotAct) return;
    // SINGLE ENTRY POINT for action spell casting:
    // - Save DC spells: resolveSpellDamage (from useActionSpellMetamagic) handles AoE modals + prepareSpellCast
    // - Non-save-DC spells: actionGateMetamagic is the single entry point (calls prepareSpellCast → spell slots, concentration)
    // NEVER call actionCastAction, castAction, or executeSpellCast directly from JSX onClick handlers.
    if (isSpellAtk && spell.saveDc) { resolveSpellDamage(attackItem); return; }
    if (isSpellAtk) { actionGateMetamagic(spell, {}); return; }
    if (resolvedDamage) { resolveSpellDamage(attackItem); return; }
    actionGateMetamagic(spell, {});
}

const CharActions = function CharActions({ playerStats, campaignName, exhaustionPenalty = 0, conditionAttackMode, conditionEffects, cannotAct, cannotActReason = null, mapName, onBuffsChange, characters, onSpellModalStateChange, spellModalState }) {
    const [actions, setActions] = useState([]);
    const [selectedActionSpell, setSelectedActionSpell] = useState(null);
    const [featRangeEffects, setFeatRangeEffects] = useState(null);
    const { saveDcBonus: displaySaveDcBonus } = getInnateSorceryBonus(playerStats.name, campaignName);
    const _activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName); (void _activeBuffs);
    const { popupHtml, setPopupHtml } = useDiceRollPopup();

    const getSpellDamageDisplay = React.useCallback((spell) => {
        if (spell.heal_at_slot_level) {
            const spellCastingMod = playerStats.spellAbilities?.modifier || 0;
            return resolveHealExpression(spell, playerStats.level, spellCastingMod);
        }
        const resolved = resolveSpellDamageAtLevel(spell, playerStats.level);
        if (!resolved || spell.level !== 0) return resolved;
        return applyPotentSpellcasting(resolved, playerStats, campaignName);
    }, [playerStats, campaignName]);

    useEffect(() => {
        computeFeatRangeEffects(playerStats.feats, playerStats.rules, playerStats).then(setFeatRangeEffects).catch((e) => { console.error("[CharActions] Error:", e); });
    }, [playerStats.feats, playerStats.rules, playerStats]);

    useEffect(() => {
        fetch('/data/actions.json')
            .then(response => response.json())
            .then(data => setActions(data))
            .catch(error => console.error('Error loading actions:', error));
    }, []);

    const { rollAttack, rollDamage, rollSkillCheck, rollAbilityCheck } = useLoggedDiceRoll(playerStats.name, campaignName, {
        characters,
        autoDamageSource: 'char-actions',
        autoDamageRoll: async (autoDamage, isCrit) => {
            const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit, playerStats);
            await resolveAttackDamage(attack, ctxOverrides);
        },
    });

    const buildCtxSync = React.useCallback(async (attack, opts) => {
        return await buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, featRangeEffects || null, opts);
    }, [playerStats, campaignName, conditionAttackMode, featRangeEffects]);

    const buildCtx = React.useCallback(async (attack, opts) => {
        return await buildAttackContext({ attack, playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects: featRangeEffects || null, opts });
    }, [playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects]);

    // Synced before useCharActionModals so its pause write can update this mirror
    // and TacticalMasterModal renders (CLA-351 / WM-003). Keyed on the valid shared
    // 'campaign' namespace (NOT campaignName) so the runtime store accepts the write.
    const [tacticalMasterModal, setTacticalMasterModal] = useSyncedState('campaign', 'tacticalMasterPending', null, campaignName);

    const {
        pendingDamage,
        modalState,
        setModalState: setModalStateInternal,
        resolveAttackDamage,
        resumeAttackPipeline,
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
        combatSuperiorityModal,
        setCombatSuperiorityModal,
        handleAttackRiderManeuverUse,
        handleAttackRiderManeuverSkip,
        handleCombatSuperiorityConfirm,
        handleFlurryOfBlowsConfirm,
        handleFlurryOfBlowsSkip,
        handleOpenHandFromFlurryConfirm,
        handleOpenHandFromFlurrySkip,
    } = useCharActionModals({
        playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects,
        popupHtml, setPopupHtml, rollDamage, rollAttack, buildCtx, buildCtxSync,
        setTacticalMasterModal,
    });

    const setModalState = React.useCallback((state) => {
        setModalStateInternal(state);
        if (onSpellModalStateChange) {
            onSpellModalStateChange(state);
        }
    }, [setModalStateInternal, onSpellModalStateChange]);

    const mergedModalState = React.useMemo(() => ({ ...modalState, ...spellModalState }), [modalState, spellModalState]);

    const [showCleaveTargetSelection, setShowCleaveTargetSelection] = useSyncedState(campaignName, 'cleavePending', false, campaignName);
    const [cleaveSecondTargets, setCleaveSecondTargets] = useSyncedState(campaignName, 'cleaveSecondTargets', [], campaignName);

    // Event listeners extracted to hook
    useCharActionsEventListeners({
        setPopupHtml,
        setModalState,
        rollDamage,
        playerName: playerStats.name,
        campaignName,
        popupHtml,
        setRuntimeValue,
    });

    // Attack handlers extracted to hook
    const {
        handleAttackClick,
        handleRecklessAttackConfirm,
        handleRecklessAttackCancel,
        handleBrutalStrikeConfirm,
        handleBrutalStrikeCancel,
    } = useCharActionsAttackHandlers({
        cannotAct,
        buildCtx,
        rollAttack,
        exhaustionPenalty,
        playerName: playerStats.name,
        campaignName,
        setModalState,
        specialActions: playerStats.automation?.specialActions,
        passives: playerStats.automation?.passives,
        playerStats,
        getRuntimeValue,
        setRuntimeValue,
        setPopupHtml,
    });

    // Modal handlers extracted to hook
    const {
        handleSweepingAttackConfirm,
        handleBaitAndSwitchChoiceConfirm,
        handleCommanderStrikeChoiceConfirm,
        handleRallyChoiceConfirm,
        handleBulwarkOfForceConfirm,
        handleZealousPresenceConfirm,
        handlePsychicWhispersConfirm,
        handleMassHealConfirm,
        handleClockworkCavalcadeHealConfirm,
        handleClockworkCavalcadeDispelConfirm,
        handleClockworkCavalcadeRepairConfirm,
        handleMassCureWoundsConfirm,
        handlePrayerOfHealingConfirm,
        handlePowerWordFortifyConfirm,
        handleMassHealingWordConfirm,
        handleNaturesSanctuaryConfirm,
        handleCoronaEnemySelectionConfirm,
        handleRadianceOfDawnConfirm,
        handleMantleOfInspirationConfirm,
        handleCelestialResilienceConfirm,
        handleCelestialResilienceSkip,
        handleInspiringSmiteConfirm,
        handleVitalityOfTheTreeConfirm,
        handleTricksterBlessingConfirm,
        handleBardicInspirationConfirm,
        handleInspiringMovementConfirm,
        handleOceanicGiftConfirm,
    } = useCharActionsModalHandlers({
        setPopupHtml,
        setModalState,
        modalState,
        mergedModalState,
    });

    // Automation handlers extracted to hook
    const {
        handleAutomationAction,
        handleDivineInterventionCast,
    } = useCharActionsAutomation({
        cannotAct,
        playerStats,
        campaignName,
        mapName,
        characters,
        getRuntimeValue,
        setRuntimeValue,
        setPopupHtml,
        setModalState,
        modalState,
        rollDamage,
        rollAttack,
        executeHandler,
        addEntry,
        onBuffsChange,
    });

    // CLA-230: Moonlight Step pool-restore surface — the Druid summary tracker's
    // "Restore Uses" row dispatches this bus event; dispatch the feature's
    // resource_pool automation half via handleAutomationAction so resourcePoolHandler
    // opens MoonlightStepResourceModal (converts a level 2+ spell slot into
    // moonlightStepUses). The Bonus Actions "Moonlight Step:" row dispatches the
    // teleport half (executeHandler picks automation[0]), so the conversion half
    // otherwise has no reachable UI.
    useEffect(() => {
        const handleMoonlightStepRestore = () => {
            const poolInfo = (playerStats.automation?.actions || []).find(
                a => a.type === 'resource_pool' && a.conversion === 'spell_slot_to_moonlight_step'
            );
            if (!poolInfo) return;
            handleAutomationAction({ name: poolInfo.name, description: poolInfo.description || '', automation: poolInfo });
        };
        window.addEventListener('moonlight-step-restore', handleMoonlightStepRestore);
        return () => window.removeEventListener('moonlight-step-restore', handleMoonlightStepRestore);
    }, [handleAutomationAction, playerStats]);

    // Base actions (Hide, Dodge, Grapple) extracted to hook
    const {
        handleHideAction,
        handleDodgeAction,
        handleGrappleAction,
    } = useCharActionsBaseActions({
        cannotAct,
        getRuntimeValue,
        setRuntimeValue,
        rollSkillCheck,
        rollAbilityCheck,
        addEntry,
        setPopupHtml,
        playerStats,
        campaignName,
        exhaustionPenalty,
        conditionEffects,
        toggleBuff,
        addExpiration,
        loadCombatSummary,
        getMonsterData,
    });

    // Cleave/Tactical Master handlers extracted to hook — not yet used in JSX
    const {
        handleCleaveAttack,
        handleTacticalMasterConfirm,
        handleTacticalMasterDismiss,
    } = useCharActionsCleave({
        setShowCleaveTargetSelection,
        setCleaveSecondTargets,
        setTacticalMasterModal,
        campaignName,
        playerStats,
        rollDamage,
        getRuntimeValue,
        setRuntimeValue,
        addEntry,
        getCombatContext,
        createSaveListener,
        applyMasteryEffect,
    });

    useInitiativeEffects(playerStats, campaignName, rollDamage);

    const getTargetInfo = React.useCallback(async () => {
        const cs = await getCombatContext(campaignName);
        if (!cs) return null;
        const target = getTargetFromAttacker(cs, playerStats.name);
        if (target) return target;
        const overlayTargetName = getAttackerTargetName(cs, playerStats.name);
        if (overlayTargetName) return { name: overlayTargetName };
        return null;
    }, [playerStats.name, campaignName]);

    const handleSimpleDamageRoll = useSimpleDamageRoll(playerStats.name, campaignName, popupHtml, setPopupHtml);

    const {
        pendingActionMetamagic,
        handleActionMetamagicConfirm,
        handleActionMetamagicSkip,
        handleActionSpellDamageClick: resolveSpellDamage,
        handleSpellAttackClick,
    } = useActionSpellMetamagic({
        playerStats,
        campaignName,
        mapName,
        exhaustionPenalty,
        cannotAct,
        popupHtml,
        setPopupHtml,
        rollAttack,
        rollDamage,
        buildCtx,
        buildCtxSync,
        handleAttackClick,
        handleDamageClick: resolveAttackDamage,
        setModalState,
        characters,
    });


    const { buildUpcastLevels } = useSpellUpcastFlow(playerStats, campaignName);

    const actionSpells = getActionSpells(playerStats, campaignName);
    const actionSpellNames = actionSpells.reduce((acc, spell) => { acc[spell.name] = spell; return acc; }, {});

    const actionAttacks = (playerStats.attacks || []).filter(a => a.type === 'Action');

    const handleActionSpellClick = (spellName) => {
        let spell = actionSpellNames[spellName];
        if (!spell) {
            spell = playerStats.spellAbilities?.spells?.find(s => s.name === spellName);
        }
        if (!spell) return;
        setSelectedActionSpell(spell);
    };

    const { resolvePositions: resolveActionSpellPositions, cachedPosRef: cachedActionCastPosRef } = useSpellPositionResolver(campaignName, mapName, playerStats.name);

    const { castAction: actionCastAction } = useSpellCastExecutor({ rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, extraMeta: { featEffects: featRangeEffects }, cachedPosRef: cachedActionCastPosRef, setModalState });

    const { pendingMetamagic: actionPendingMetamagic, gateMetamagic: actionGateMetamagic, handleConfirm: actionHandleConfirm, handleSkip: actionHandleSkip, pendingAid: actionPendingAid, handleAidConfirm: actionHandleAidConfirm, handleAidSkip: actionHandleAidSkip, pendingBane: actionPendingBane, handleBaneConfirm: actionHandleBaneConfirm, handleBaneSkip: actionHandleBaneSkip, pendingBless: actionPendingBless, handleBlessConfirm: actionHandleBlessConfirm, handleBlessSkip: actionHandleBlessSkip, pendingFaerieFire: actionPendingFaerieFire, handleFaerieFireConfirm: actionHandleFaerieFireConfirm, handleFaerieFireSkip: actionHandleFaerieFireSkip, pendingBeaconOfHope: actionPendingBeaconOfHope, handleBeaconOfHopeConfirm: actionHandleBeaconOfHopeConfirm, handleBeaconOfHopeSkip: actionHandleBeaconOfHopeSkip, pendingPassWithoutTrace: actionPendingPassWithoutTrace, handlePassWithoutTraceConfirm: actionHandlePassWithoutTraceConfirm, handlePassWithoutTraceSkip: actionHandlePassWithoutTraceSkip, pendingHaste: actionPendingHaste, handleHasteConfirm: actionHandleHasteConfirm, handleHasteSkip: actionHandleHasteSkip, pendingBarkskin: actionPendingBarkskin, handleBarkskinConfirm: actionHandleBarkskinConfirm, handleBarkskinSkip: actionHandleBarkskinSkip, pendingHeal: actionPendingHeal, handleHealConfirm: actionHandleHealConfirm, handleHealSkip: actionHandleHealSkip, pendingGreaterRestoration: actionPendingGreaterRestoration, handleGreaterRestorationConfirm: actionHandleGreaterRestorationConfirm, handleGreaterRestorationSkip: actionHandleGreaterRestorationSkip, handleGreaterRestorationNoEffects: actionHandleGreaterRestorationNoEffects, pendingRemoveCurse: actionPendingRemoveCurse, handleRemoveCurseConfirm: actionHandleRemoveCurseConfirm, handleRemoveCurseSkip: actionHandleRemoveCurseSkip, pendingMagicMissile: actionPendingMagicMissile, handleMagicMissileConfirm: actionHandleMagicMissileConfirm, handleMagicMissileSkip: actionHandleMagicMissileSkip, pendingMageArmor: actionPendingMageArmor, handleMageArmorConfirm: actionHandleMageArmorConfirm, handleMageArmorSkip: actionHandleMageArmorSkip, pendingCureWounds: actionPendingCureWounds, handleCureWoundsConfirm: actionHandleCureWoundsConfirm, handleCureWoundsSkip: actionHandleCureWoundsSkip, pendingRevivify: actionPendingRevivify, handleRevivifyConfirm: actionHandleRevivifyConfirm, handleRevivifySkip: actionHandleRevivifySkip } = useSpellMetamagicFlow(playerStats, campaignName, actionCastAction, setModalState, characters, setPopupHtml);

    const handleActionSpellCast = React.useCallback(async (spell, metaCtx) => {
        setSelectedActionSpell(null);
        await resolveActionSpellPositions();
        actionGateMetamagic(spell, metaCtx);
    }, [actionGateMetamagic, resolveActionSpellPositions]);

    const showMastery = playerStats.rules === '2024' && hasWeaponKindMastery(playerStats);

    const categories = getCategories(playerStats.rules || '5e');

    return (
        <div className="char-actions">
            {/*
             * CHAR ACTIONS — Spells with casting time of "Action" that deal damage or healing.
             * These are spells that go on the action bar of the character sheet.
             * Use getActionSpellNames() to determine which spells belong here.
             *
             * MODALS/HANDLERS: Action-based spells that need target selection or complex automation
             * go in CharActionModals.jsx and CharActionSpellPopups.jsx (e.g. Aid, Greater Restoration,
             * Mass Cure Wounds, Mass Healing Word, Prayer of Healing, Power Word Fortify, etc.).
             * These are triggered from the action spell cast flow, not from CharSpells.
             *
             * DO NOT put reaction or bonus action spell handlers here.
             */}
            <div>
                <div className='sectionHeader'>Actions</div>
                {renderCannotActLabel(cannotAct, cannotActReason)}
                <div className={`attacks ${showMastery ? 'mastery-enabled' : ''}`}>
                    <div className='left'><b>Name</b></div>
                    <div><b>Level</b></div>
                    <div><b>Range</b></div>
                    <div><b>Hit</b></div>
                    <div><b>Damage</b></div>
                    <div className='left'><b>Type</b></div>
                    {showMastery && <div><b>Mastery</b></div>}
                    {actionAttacks.map((attack) => {
                        const attackLevel = getAttackSpellLevel(playerStats.spellAbilities, attack.name);
                        const attackItem = { ...attack };
                        const sacredWeaponBonus = (() => {
                            const buffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
                            if (!Array.isArray(buffs) || !buffs.some(b => b.effect === 'sacred_weapon')) return 0;
                            if (attack.weaponType !== 'melee' && attack.weaponType !== 'unarmed') return 0;
                            const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
                            return Math.max(1, cha?.bonus || 0);
                        })();
                        const effectiveHit = attack.hitBonus + sacredWeaponBonus;
                        const hitTitle = sacredWeaponBonus > 0
                            ? `Base: +${attack.hitBonus}, Sacred Weapon: +${sacredWeaponBonus}`
                            : undefined;
                        return <React.Fragment key={attack.name}>
                            <div className='left clickable' onClick={() => handleAttackClick(attackItem)}>{attack.name}</div>
                            <div>{attackLevel != null ? (attackLevel === 0 ? 'Cantrip' : attackLevel) : ''}</div>
                            <div>{formatRange(attack.range)}</div>
                            {attack.saveDc
                                ? <div className="save-dc-display">DC {attack.saveDc + displaySaveDcBonus} {attack.saveType}</div>
                                : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} title={hitTitle} onClick={() => handleAttackClick(attackItem)}>{signFormatter.format(effectiveHit - exhaustionPenalty)}</div>}
                            <div className={attack.damage ? "clickable" : ""} onClick={() => {
                                if (cannotAct) return;
                                if (attack.saveDc) { resolveSpellDamage(attackItem); return; }
                                handleSimpleDamageRoll(attackItem);
                            }}>{attack.damage}</div>
                            <div className='left'>{attack.damageType}</div>
                            {showMastery && (() => { const mastery = getWeaponMastery(attack.name, attack, playerStats); return <div className={mastery ? "clickable" : ""} onClick={() => { if (mastery) showWeaponMasteryPopup(mastery, setPopupHtml); }}>{mastery}</div>; })()}
                        </React.Fragment>;
                    })}
                    {actionSpells.map((spell) => {
                        const { damageType, resolvedDamage, autoHit, isSpellAtk, hasAttackType, attackItem } = resolveActionSpellRow(spell, playerStats);
                        return <React.Fragment key={spell.name}>
                            <div className='left clickable' onClick={() => handleActionSpellClick(spell.name)}>{spell.name}</div>
                            <div>{spell.level === 0 ? 'Cantrip' : spell.level}</div>
                            <div>{formatRange(spell.range)}</div>
                            {renderActionSpellHitCell({ autoHit, isSpellAtk, hasAttackType, cannotAct, conditionAttackMode, toHit: playerStats.spellAbilities?.toHit, exhaustionPenalty, saveDc: playerStats.spellAbilities?.saveDc, displaySaveDcBonus, dcType: spell.dc?.dc_type, attackItem, handleSpellAttackClick })}
                            <div className={resolvedDamage ? "clickable" : ""} onClick={() => handleActionSpellDamageClick({ attackItem, spell, isSpellAtk, resolvedDamage, cannotAct, resolveSpellDamage, actionGateMetamagic })}>{getSpellDamageDisplay(spell)}</div>
                            {renderActionSpellTypeCell(spell, damageType)}
                            {showMastery && <div></div>}
                        </React.Fragment>;
                    })}
                </div>
                <div className='half-line'></div>
                <CharActionModals
                    playerStats={playerStats}
                    campaignName={campaignName}
                    mapName={mapName}
                    characters={characters}
                    modalState={modalState}
                    spellModalState={spellModalState}
                    setModalState={setModalState}
                    setSpellModalState={onSpellModalStateChange}
                    combatSuperiorityModal={combatSuperiorityModal}
                    setCombatSuperiorityModal={setCombatSuperiorityModal}
                    handleCombatSuperiorityConfirm={handleCombatSuperiorityConfirm}
                    handleAttackRiderManeuverUse={handleAttackRiderManeuverUse}
                    handleAttackRiderManeuverSkip={handleAttackRiderManeuverSkip}
                    handleSweepingAttackConfirm={handleSweepingAttackConfirm}
                    handleBaitAndSwitchChoiceConfirm={handleBaitAndSwitchChoiceConfirm}
                    handleCommanderStrikeChoiceConfirm={handleCommanderStrikeChoiceConfirm}
                    handleRallyChoiceConfirm={handleRallyChoiceConfirm}
                    handleBulwarkOfForceConfirm={handleBulwarkOfForceConfirm}
                    handleZealousPresenceConfirm={handleZealousPresenceConfirm}
                    handlePsychicWhispersConfirm={handlePsychicWhispersConfirm}
                    handleNaturesSanctuaryConfirm={handleNaturesSanctuaryConfirm}
                    handleCoronaEnemySelectionConfirm={handleCoronaEnemySelectionConfirm}
                    handleRadianceOfDawnConfirm={handleRadianceOfDawnConfirm}
                    handleMantleOfInspirationConfirm={handleMantleOfInspirationConfirm}
                    handleCelestialResilienceConfirm={handleCelestialResilienceConfirm}
                    handleCelestialResilienceSkip={handleCelestialResilienceSkip}
                    handleInspiringSmiteConfirm={handleInspiringSmiteConfirm}
                    handleVitalityOfTheTreeConfirm={handleVitalityOfTheTreeConfirm}
                    handleTricksterBlessingConfirm={handleTricksterBlessingConfirm}
                    handleBardicInspirationConfirm={handleBardicInspirationConfirm}
                    handleInspiringMovementConfirm={handleInspiringMovementConfirm}
                    handleOceanicGiftConfirm={handleOceanicGiftConfirm}
                    handleDivineInterventionCast={handleDivineInterventionCast}
                    pendingDamage={pendingDamage}
                    resumeAttackPipeline={resumeAttackPipeline}
                    buildCtx={buildCtx}
                    buildCtxSync={buildCtxSync}
                    rollDamage={rollDamage}
                    setPopupHtml={setPopupHtml}
                    mapName={mapName}
                    handleMasteryClose={handleMasteryClose}
                    handleWeaponMasteryChoice={handleWeaponMasteryChoice}
                    handleWeaponKindMasteryClose={handleWeaponKindMasteryClose}
                    handleDivineFuryDamageType={handleDivineFuryDamageType}
                    handleDivineFurySkip={handleDivineFurySkip}
                    handleGenericDamageTypeChoice={handleGenericDamageTypeChoice}
                    handleGenericDamageTypeSkip={handleGenericDamageTypeSkip}
                    handleDamageTypeModifierChoice={handleDamageTypeModifierChoice}
                    handleDamageTypeModifierSkip={handleDamageTypeModifierSkip}
                    handleEnhancedUnarmedChoice={handleEnhancedUnarmedChoice}
                    handleEnhancedUnarmedSkip={handleEnhancedUnarmedSkip}
                    handleFeatureChoiceConfirm={handleFeatureChoiceConfirm}
                    handleFeatureChoiceSkip={handleFeatureChoiceSkip}
                    handleConstellationSelect={handleConstellationSelect}
                    handleRecklessAttackConfirm={handleRecklessAttackConfirm}
                    handleRecklessAttackCancel={handleRecklessAttackCancel}
                    handleBrutalStrikeConfirm={handleBrutalStrikeConfirm}
                    handleBrutalStrikeCancel={handleBrutalStrikeCancel}
                    handleMassHealConfirm={handleMassHealConfirm}
                    handleClockworkCavalcadeHealConfirm={handleClockworkCavalcadeHealConfirm}
                    handleClockworkCavalcadeDispelConfirm={handleClockworkCavalcadeDispelConfirm}
                    handleClockworkCavalcadeRepairConfirm={handleClockworkCavalcadeRepairConfirm}
                    handleMassCureWoundsConfirm={handleMassCureWoundsConfirm}
                    handlePrayerOfHealingConfirm={handlePrayerOfHealingConfirm}
                    handlePowerWordFortifyConfirm={handlePowerWordFortifyConfirm}
                    handleMassHealingWordConfirm={handleMassHealingWordConfirm}
                    handleFlurryOfBlowsConfirm={handleFlurryOfBlowsConfirm}
                    handleFlurryOfBlowsSkip={handleFlurryOfBlowsSkip}
                    handleOpenHandFromFlurryConfirm={handleOpenHandFromFlurryConfirm}
                    handleOpenHandFromFlurrySkip={handleOpenHandFromFlurrySkip}
                />
                <CharActionSpellPopups
                    playerStats={playerStats}
                    campaignName={campaignName}
                    selectedActionSpell={selectedActionSpell}
                    setSelectedActionSpell={setSelectedActionSpell}
                    buildUpcastLevels={buildUpcastLevels}
                    handleActionSpellCast={handleActionSpellCast}
                    actionPendingMetamagic={actionPendingMetamagic}
                    actionHandleConfirm={actionHandleConfirm}
                    actionHandleSkip={actionHandleSkip}
                    actionPendingAid={actionPendingAid}
                    actionHandleAidConfirm={actionHandleAidConfirm}
                    actionHandleAidSkip={actionHandleAidSkip}
                    actionPendingBane={actionPendingBane}
                    actionHandleBaneConfirm={actionHandleBaneConfirm}
                    actionHandleBaneSkip={actionHandleBaneSkip}
                    actionPendingBless={actionPendingBless}
                    actionHandleBlessConfirm={actionHandleBlessConfirm}
                    actionHandleBlessSkip={actionHandleBlessSkip}
                    actionPendingFaerieFire={actionPendingFaerieFire}
                    actionHandleFaerieFireConfirm={actionHandleFaerieFireConfirm}
                    actionHandleFaerieFireSkip={actionHandleFaerieFireSkip}
                    actionPendingBeaconOfHope={actionPendingBeaconOfHope}
                    actionHandleBeaconOfHopeConfirm={actionHandleBeaconOfHopeConfirm}
                    actionHandleBeaconOfHopeSkip={actionHandleBeaconOfHopeSkip}
                    actionPendingPassWithoutTrace={actionPendingPassWithoutTrace}
                    actionHandlePassWithoutTraceConfirm={actionHandlePassWithoutTraceConfirm}
                    actionHandlePassWithoutTraceSkip={actionHandlePassWithoutTraceSkip}
                    actionPendingHaste={actionPendingHaste}
                    actionHandleHasteConfirm={actionHandleHasteConfirm}
                    actionHandleHasteSkip={actionHandleHasteSkip}
                    actionPendingBarkskin={actionPendingBarkskin}
                    actionHandleBarkskinConfirm={actionHandleBarkskinConfirm}
                    actionHandleBarkskinSkip={actionHandleBarkskinSkip}
                    actionPendingHeal={actionPendingHeal}
                    actionHandleHealConfirm={actionHandleHealConfirm}
                    actionHandleHealSkip={actionHandleHealSkip}
                    actionPendingGreaterRestoration={actionPendingGreaterRestoration}
                    actionHandleGreaterRestorationConfirm={actionHandleGreaterRestorationConfirm}
                    actionHandleGreaterRestorationSkip={actionHandleGreaterRestorationSkip}
                    actionHandleGreaterRestorationNoEffects={actionHandleGreaterRestorationNoEffects}
                    actionPendingRemoveCurse={actionPendingRemoveCurse}
                    actionHandleRemoveCurseConfirm={actionHandleRemoveCurseConfirm}
                    actionHandleRemoveCurseSkip={actionHandleRemoveCurseSkip}
                    actionPendingMagicMissile={actionPendingMagicMissile}
                    actionHandleMagicMissileConfirm={actionHandleMagicMissileConfirm}
                    actionHandleMagicMissileSkip={actionHandleMagicMissileSkip}
                    actionPendingMageArmor={actionPendingMageArmor}
                    actionHandleMageArmorConfirm={actionHandleMageArmorConfirm}
                    actionHandleMageArmorSkip={actionHandleMageArmorSkip}
                    actionPendingCureWounds={actionPendingCureWounds}
                    actionHandleCureWoundsConfirm={actionHandleCureWoundsConfirm}
                    actionHandleCureWoundsSkip={actionHandleCureWoundsSkip}
                    actionPendingRevivify={actionPendingRevivify}
                    actionHandleRevivifyConfirm={actionHandleRevivifyConfirm}
                    actionHandleRevivifySkip={actionHandleRevivifySkip}
                    pendingActionMetamagic={pendingActionMetamagic}
                    handleActionMetamagicConfirm={handleActionMetamagicConfirm}
                    handleActionMetamagicSkip={handleActionMetamagicSkip}
                />
                {(playerStats.actions || []).filter(a => !categories.featuresToIgnore.includes(a.name)).map((action) => renderFeatureActionRow(action, playerStats, handleAutomationAction, setPopupHtml))}
                <div><b>Base Actions:</b> {actions.map((actionName, idx) => {
                    if (actionName === 'Hide') {
                        return <React.Fragment key={idx}>{idx > 0 && ', '}<span className="base-action-clickable" onClick={handleHideAction}>{actionName}</span></React.Fragment>;
                    }
                    if (actionName === 'Dodge') {
                        return <React.Fragment key={idx}>{idx > 0 && ', '}<span className="base-action-clickable" onClick={handleDodgeAction}>{actionName}</span></React.Fragment>;
                    }
                    if (actionName === 'Grapple') {
                        return <React.Fragment key={idx}>{idx > 0 && ', '}<span className="base-action-clickable" onClick={handleGrappleAction}>{actionName}</span></React.Fragment>;
                    }
                    return <React.Fragment key={idx}>{idx > 0 && ', '}{actionName}</React.Fragment>;
                })}</div>
            </div>
            <CharBonusActions
                playerStats={playerStats}
                campaignName={campaignName}
                exhaustionPenalty={exhaustionPenalty}
                conditionAttackMode={conditionAttackMode}
                cannotAct={cannotAct}
                mapName={mapName}
                onAttackClick={handleAttackClick}
                onResolveAttackDamage={resolveAttackDamage}
                onResolveSpellDamage={resolveSpellDamage}
                onAutomationAction={handleAutomationAction}
                getWeaponMastery={getWeaponMastery}
                rollAttack={rollAttack}
                rollDamage={rollDamage}
                getTargetInfo={getTargetInfo}
                characters={characters}
                modalState={modalState}
                setModalState={setModalState}
            />
            <PendingActionModalsHost
                showCleaveTargetSelection={showCleaveTargetSelection}
                cleaveSecondTargets={cleaveSecondTargets}
                handleCleaveAttack={handleCleaveAttack}
                setShowCleaveTargetSelection={setShowCleaveTargetSelection}
                setCleaveSecondTargets={setCleaveSecondTargets}
                tacticalMasterModal={tacticalMasterModal}
                handleTacticalMasterConfirm={handleTacticalMasterConfirm}
                handleTacticalMasterDismiss={handleTacticalMasterDismiss}
                resumeAttackPipeline={resumeAttackPipeline}
                playerStats={playerStats}
                campaignName={campaignName}
                modalState={modalState}
            />
        </div>
    )
}

export default CharActions
