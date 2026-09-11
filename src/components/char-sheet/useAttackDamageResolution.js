import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { addEntry } from '../../services/ui/logService.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import { executeAttackRiderManeuver as executeAttackRiderManeuverService, applyManeuveringAllyGrant } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { buildPipelineForAction } from '../../services/combat/steps/index.js';

/**
 * Standalone resolveAttackDamage for use outside React hooks (e.g., CharSpells, MonsterCardModal).
 */
export async function resolveAttackDamageStandalone(attack, ctxOverrides, { playerStats, campaignName, setPopupHtml, rollDamage, setModalState: _setModalState }) {
    const modalState = {};
    const setModalStateFn = (updates) => { Object.assign(modalState, updates); };

    const proceedWithDamage = (a, formula, total, rolls, modifier) => {
        const o = ctxOverrides;
        const minimalCtx = {
            attackName: a.name,
            damageType: a.damageType,
            targetName: o.targetName || null,
            attackerName: o.attackerName || a.name,
            isAutoCrit: o.isCrit || false,
            doubledRolls: o.doubledRolls || null,
            playerStats: o.playerStats || null,
            autoDamageSecondaryFormula: o.autoDamageSecondaryFormula || null,
            autoDamageSecondaryName: o.autoDamageSecondaryName || null,
            autoDamageSecondaryDamageType: o.autoDamageSecondaryDamageType || null,
            saveDc: o.saveDc || null,
            saveType: o.saveType || null,
            dcSuccess: o.dcSuccess || null,
            metamagicTwinTarget: o.metamagicTwinTarget || null,
            metamagicHeighten: o.metamagicHeighten || false,
        };
        rollDamage(a.name, formula, total, rolls, modifier, minimalCtx);
    };

    const ctx = {
        attack,
        playerStats,
        campaignName,
        mapName: null,
        popupHtml: null,
        hit: ctxOverrides.hit ?? true,
        isCrit: ctxOverrides.isCrit ?? false,
        isNatural20: ctxOverrides.isNatural20 ?? false,
        targetName: ctxOverrides.targetName ?? null,
        isBonusActionAttack: ctxOverrides.isBonusActionAttack ?? false,
        formula: null,
        total: 0,
        rolls: [],
        modifier: 0,
        sneakDice: 0,
        effectiveSneakDice: 0,
        isMeleeOrUnarmed: false,
        buildCtxResult: null,
        autoFormulaOverride: null,
        overchannelActive: ctxOverrides.overchannelActive ?? false,
        overchannelUseCount: ctxOverrides.overchannelUseCount ?? 0,
        overchannelSpellLevel: ctxOverrides.overchannelSpellLevel ?? 1,
        autoDamageSaveDc: null,
        empoweredEvocationModifier: ctxOverrides.empoweredEvocationModifier ?? 0,
        setPopupHtml,
        setDamageTypeChoice: (v) => setModalStateFn({ damageTypeChoice: v }),
        setDivineFuryChoice: (v) => setModalStateFn({ divineFuryChoice: v }),
        setAttackRiderModal: (v) => setModalStateFn({ attackRiderModal: v }),
        setAttackRiderManeuverPrompt: (v) => setModalStateFn({ attackRiderManeuverPrompt: v }),
        setSweepingAttackTargetModal: (v) => setModalStateFn({ sweepingAttackTargetModal: v }),
        setSecondaryTargetModal: (v) => setModalStateFn({ secondaryTargetModal: v }),
        buildCtx: null,
        buildCtxSync: null,
        proceedWithDamage,
        rollDamage,
        ...ctxOverrides,
    };

    const pipeline = buildPipelineForAction(attack, playerStats);
    await pipeline.run('housekeeping:do', ctx, { current: null });
}

/**
 * Normalize an autoDamage object (from dice roll popup) into an attack-like object
 * + context overrides for the pipeline.
 *
 * @param {object} autoDamage - The autoDamage object from the dice roll popup
 * @param {boolean} isCrit - Whether the attack was a critical hit
 * @param {object} playerStats - The acting character's computed stats
 * @returns {{ attack: object, ctx: object }}
 */
// SP-112: carry spell-attack tokens (school / attackType) through to the pipeline
// attack so weapon-only damage_bonus riders (Divine Strike family) can discriminate
// spells. weaponType stays registry-authoritative (never flipped to spell here).
function buildNormalizedAttack(autoDamage, isUnarmed, weaponAttack) {
  return {
    name: autoDamage.name,
    damage: autoDamage.formula,
    damageType: autoDamage.damageType,
    weaponType: isUnarmed ? 'unarmed' : (weaponAttack?.weaponType || 'weapon'),
    attackType: autoDamage.attackType || weaponAttack?.attackType,
    school: autoDamage.autoDamageSchool || weaponAttack?.school,
    properties: weaponAttack?.properties || [],
    type: autoDamage.attackType || weaponAttack?.type,
    isHordeBreaker: weaponAttack?.isHordeBreaker || false,
  };
}

// Compute Empowered Evocation modifier
function resolveEmpoweredEvocationModifier(autoDamage, playerStats) {
  const hasEmpoweredEvoc = playerStats ? getEmpoweredEvocationFeatures(playerStats).length > 0 : false;
  const empEvocIntMod = (hasEmpoweredEvoc && playerStats) ? getEmpoweredEvocationIntModifier(playerStats) : 0;
  const spellSchool = (autoDamage.autoDamageSchool || '').toLowerCase();
  const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && spellSchool === 'evocation' && empEvocIntMod > 0;
  return shouldApplyEmpoweredEvoc ? empEvocIntMod : 0;
}

function buildNormalizedCtx(autoDamage, isCrit, empoweredEvocationModifier) {
  const isCritRoll = isCrit || autoDamage.isAutoCrit || false;
  return {
    attackName: autoDamage.name,
    hit: true,
    isCrit: isCritRoll,
    isAutoCrit: isCritRoll,
    isNatural20: isCrit || false,
    targetName: autoDamage.targetName || null,
    isBonusActionAttack: false,
    overchannelActive: autoDamage.overchannelActive || false,
    overchannelUseCount: autoDamage.overchannelUseCount || 0,
    overchannelSpellLevel: autoDamage.overchannelSpellLevel || 1,
    sneakDice: autoDamage.sneakAttackDice || 0,
    saveDc: autoDamage.saveDc,
    saveType: autoDamage.saveType,
    dcSuccess: autoDamage.dcSuccess,
    autoDamageSource: true,
    empoweredEvocationModifier,
    autoDamageSecondaryFormula: autoDamage.secondaryFormula,
    autoDamageSecondaryName: autoDamage.secondaryName,
    autoDamageSecondaryDamageType: autoDamage.secondaryDamageType,
    attackerName: autoDamage.attackerName,
    isCantrip: autoDamage.isCantrip || false,
    metamagicHeighten: autoDamage.metamagicHeighten || false,
    metamagicTwinTarget: autoDamage.metamagicTwinTarget || null,
    autoDamageSchool: autoDamage.autoDamageSchool || '',
    d20Roll: autoDamage.d20Roll,
  };
}

export function normalizeAutoDamage(autoDamage, isCrit, playerStats) {
  const isUnarmed = autoDamage.name?.includes('Unarmed Strike');
  const weaponAttack = playerStats?.attacks?.find(a => a.name === autoDamage.name);
  const attack = buildNormalizedAttack(autoDamage, isUnarmed, weaponAttack);
  const empoweredEvocationModifier = resolveEmpoweredEvocationModifier(autoDamage, playerStats);
  const ctx = buildNormalizedCtx(autoDamage, isCrit, empoweredEvocationModifier);
    return { attack, ctx };
}

async function handlePrecisionAttackMiss({ popupHtml, maneuver, currentFormula, currentTotal, currentRolls, playerStats, resumeRef, setModalState, setPopupHtml, resumeAttackPipeline }) {
    const dieRoll = rollExpression(maneuver.dieExpression || 'superiority_die');
    const dieValue = dieRoll?.total || evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);
    const origD20 = (popupHtml.rolls?.[0] != null && popupHtml.rolls[0] !== 20) ? popupHtml.rolls[0] : (popupHtml.rolls?.[0] || 0);
    const origBonus = popupHtml.bonus || 0;
    const origTotal = origD20 + origBonus;
    const newTotal = origTotal + dieValue;
    const targetAC = popupHtml.targetAc || 10;
    const newHit = newTotal >= targetAC;
    const isNatural20 = origD20 === 20;
    const wasCrit = popupHtml.isCrit;

    const updatedPopup = {
        ...popupHtml,
        total: newTotal,
        hit: newHit,
        isCrit: isNatural20 || wasCrit,
        isNatural20: isNatural20,
        superiorityDieAdded: dieValue,
        originalTotal: origTotal,
        originalD20: origD20,
    };

    const dieDesc = `Precision Attack: Added ${dieValue} to the attack roll (${origD20} + ${origBonus} + ${dieValue} = ${newTotal}). ${newHit ? 'The attack now hits!' : 'The attack still misses.'}`;

    const stash = resumeRef.current?.pipelineStash;
    if (stash?.ctx) {
        stash.ctx.hit = newHit;
        stash.ctx.popupHtml = updatedPopup;
    }

    setModalState({ attackRiderManeuverPrompt: null });
    setPopupHtml(updatedPopup);

    if (newHit) {
        await resumeAttackPipeline();
    }

    return {
        formula: currentFormula,
        total: currentTotal,
        rolls: currentRolls,
        isMissResult: true,
        hit: newHit,
        description: dieDesc,
    };
}

async function openManeuveringAllyModal({ result, popupHtmlData, attackInfo, playerStats, campaignName, setModalState, setPopupHtml }) {
    const grantTargetName = popupHtmlData?.targetName || attackInfo.targetName || null;
    const cs = await getCombatContext(campaignName);
    const allies = (cs?.creatures || [])
        .filter(c => c.name !== playerStats.name && c.type === 'player')
        .map(c => ({ name: c.name, currentHp: c.currentHp, maxHp: c.maxHp, type: c.type }));
    if (allies.length > 0) {
        setModalState({ secondaryTargetModal: {
            title: 'Maneuvering Attack — Choose Ally',
            icon: 'fa-person-walking',
            targets: allies,
            confirmLabel: 'Grant Movement',
            confirmIcon: 'fa-person-walking',
            description: `Choose a willing creature within 30 feet who can see or hear you. That creature can use its Reaction to move up to half its Speed without provoking Opportunity Attacks from ${grantTargetName || 'the target'}.`,
            onTargetSelected: async (allyName) => {
                setModalState({ secondaryTargetModal: null });
                const grant = await applyManeuveringAllyGrant(allyName, playerStats.name, grantTargetName, campaignName);
                setPopupHtml({ type: 'automation_info', name: 'Maneuvering Attack', description: grant.description });
            },
            onSkip: () => {
                setModalState({ secondaryTargetModal: null });
                setPopupHtml({ ...result.payload, description: `${result.payload.description || ''} No ally received the movement grant.` });
            },
        } });
    } else {
        setPopupHtml({ ...result.payload, description: `${result.payload.description || ''} No willing allies are within range to receive the movement grant.` });
    }
}

// MN-015: a size-gate refusal must NOT ride the maneuver die onto damage.
async function applyRiderDieBonusToFormula({ result, maneuver, attack, playerStats, campaignName, updatedFormula, updatedTotal, updatedRolls }) {
    if (!(result?.type === 'popup' && !result.refused && maneuver?.damageBonus)) {
        return { updatedFormula, updatedTotal, updatedRolls };
    }
    const dieValue = Number(result.dieValue) || rollExpression(maneuver.dieExpression || 'superiority_die')?.total || evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);
    if (dieValue > 0) {
        await setRuntimeValue(playerStats.name, 'attackRiderDieValue', dieValue, campaignName);
        if (updatedFormula != null) {
            updatedFormula += ` + ${dieValue} [${attack.damageType || 'same_as_weapon'}]`;
            updatedTotal += dieValue;
            updatedRolls = [...updatedRolls, dieValue];
        }
    }
    return { updatedFormula, updatedTotal, updatedRolls };
}

async function flushRiderManeuverLogEntries(result, campaignName) {
    if (!result?.logEntries?.length) return;
    for (const entry of result.logEntries) {
        await addEntry(campaignName, entry).catch((e) => { console.error('[attackRiderManeuver:log-error]', e); });
    }
}

async function dispatchRiderManeuverPopup({ result, maneuver, popupHtmlData, attackInfo, playerStats, campaignName, setModalState, setPopupHtml }) {
    if (result?.type === 'popup' && maneuver?.effect === 'ally_movement') {
        await openManeuveringAllyModal({ result, popupHtmlData, attackInfo, playerStats, campaignName, setModalState, setPopupHtml });
    } else if (result?.type === 'popup') {
        setPopupHtml(result.payload);
    }
}

async function applyRiderManeuverPostResolution({ result, maneuver, attack, popupHtmlData, attackInfo, playerStats, campaignName, setModalState, setPopupHtml, updatedFormula, updatedTotal, updatedRolls, resumeAttackPipeline }) {
    if (result?.type === 'modal' && result.modalName === 'attackRiderOptions') {
        setModalState({ attackRiderOptionsModal: result.payload });
        return { formula: updatedFormula, total: updatedTotal, rolls: updatedRolls, pendingOptions: true };
    }

    ({ updatedFormula, updatedTotal, updatedRolls } = await applyRiderDieBonusToFormula({ result, maneuver, attack, playerStats, campaignName, updatedFormula, updatedTotal, updatedRolls }));

    setModalState({ attackRiderManeuverPrompt: null });
    await flushRiderManeuverLogEntries(result, campaignName);
    await dispatchRiderManeuverPopup({ result, maneuver, popupHtmlData, attackInfo, playerStats, campaignName, setModalState, setPopupHtml });
    if (result?.type === 'modal' && result.modalName === 'sweepingAttackTarget') {
        setModalState({ sweepingAttackTargetModal: result.payload });
        await resumeAttackPipeline();
        return { formula: updatedFormula, total: updatedTotal, rolls: updatedRolls, chooserOpened: true };
    }

    await resumeAttackPipeline();

    return { formula: updatedFormula, total: updatedTotal, rolls: updatedRolls };
}

export default function useAttackDamageResolution({
    playerStats, campaignName, mapName,
    popupHtml, setPopupHtml, rollDamage, buildCtx, buildCtxSync,
    setModalState, _modalState,
    setPendingDamage,
    setTacticalMasterModal,
    resumeRef = { current: null },
}) {
    let pendingCtxOverrides = {};

    const proceedWithDamage = (attack, formula, total, rolls, modifier, critLabels, pipelineCtx) => {
        console.log('[sw-debug] proceedWithDamage attack.damageType=', attack?.damageType, 'formula=', formula);
        if (buildCtxSync) {
            // WM-008: damage-phase ctx rebuild must NOT consume one-shot attack te.
            (mapName ? buildCtx(attack, { consumeAttackTe: false }) : buildCtxSync(attack, { consumeAttackTe: false })).then(ctx => {
                const merged = {
                    ...ctx,
                    ...pendingCtxOverrides,
                    autoDamageSecondaryFormula: pipelineCtx?.autoDamageSecondaryFormula || pendingCtxOverrides?.autoDamageSecondaryFormula || null,
                    autoDamageSecondaryName: pipelineCtx?.autoDamageSecondaryName || pendingCtxOverrides?.autoDamageSecondaryName || null,
                    autoDamageSecondaryDamageType: pipelineCtx?.autoDamageSecondaryDamageType || pendingCtxOverrides?.autoDamageSecondaryDamageType || null,
                    saveDc: pipelineCtx?.saveDc || pendingCtxOverrides?.saveDc || null,
                    saveType: pipelineCtx?.saveType || pendingCtxOverrides?.saveType || null,
                    dcSuccess: pipelineCtx?.dcSuccess || pendingCtxOverrides?.dcSuccess || null,
                    tavernBrawlerRerolls: pipelineCtx?.tavernBrawlerRerolls || null,
                };
                console.log('[sw-debug] rollDamage ctx.damageType=', merged.damageType);
                rollDamage(attack.name, formula, total, rolls, modifier, { ...merged, ...critLabels });
            }).catch((e) => { console.error("[useAttackDamageResolution] Error:", e); });
        } else {
            const o = pendingCtxOverrides;
            const minimalCtx = {
                damageType: attack.damageType,
                targetName: o.targetName || null,
                attackerName: attack.name,
                critLabels: critLabels || null,
                autoDamageSecondaryFormula: o.autoDamageSecondaryFormula || null,
                autoDamageSecondaryName: o.autoDamageSecondaryName || null,
                autoDamageSecondaryDamageType: o.autoDamageSecondaryDamageType || null,
                saveDc: o.saveDc || null,
                saveType: o.saveType || null,
                dcSuccess: o.dcSuccess || null,
                tavernBrawlerRerolls: pipelineCtx?.tavernBrawlerRerolls || null,
            };
            rollDamage(attack.name, formula, total, rolls, modifier, minimalCtx);
        }
    };

    /**
     * Run the attack damage pipeline. For manual damage clicks, context comes from popupHtml.
     * For auto-damage (after an attack roll), pass ctxOverrides from normalizeAutoDamage().
     */
    const resolveAttackDamage = async (attack, ctxOverrides = {}) => {
        pendingCtxOverrides = ctxOverrides;
        const ctx = {
            attack,
            playerStats,
            campaignName,
            mapName,
            popupHtml,
            hit: ctxOverrides.hit ?? (popupHtml?.hit === true || popupHtml?.isCrit === true),
            isCrit: ctxOverrides.isCrit ?? (popupHtml?.isCrit === true),
            isNatural20: ctxOverrides.isNatural20 ?? (popupHtml?.isNatural20 === true),
            targetName: ctxOverrides.targetName ?? (popupHtml?.targetName || null),
            isBonusActionAttack: ctxOverrides.isBonusActionAttack ?? (attack?.type === 'Bonus Action'),
            formula: null,
            total: 0,
            rolls: [],
            modifier: 0,
            sneakDice: 0,
            effectiveSneakDice: 0,
            isMeleeOrUnarmed: false,
            buildCtxResult: null,
            autoFormulaOverride: null,
            overchannelActive: ctxOverrides.overchannelActive ?? false,
            overchannelUseCount: ctxOverrides.overchannelUseCount ?? 0,
            overchannelSpellLevel: ctxOverrides.overchannelSpellLevel ?? 1,
            autoDamageSaveDc: null,
            empoweredEvocationModifier: ctxOverrides.empoweredEvocationModifier ?? 0,
            setPopupHtml,
            setDamageTypeChoice: (v) => setModalState({ damageTypeChoice: v }),
            setDivineFuryChoice: (v) => setModalState({ divineFuryChoice: v }),
            setAttackRiderModal: (v) => setModalState({ attackRiderModal: v }),
            setAttackRiderManeuverPrompt: (v) => setModalState({ attackRiderManeuverPrompt: v }),
            setSweepingAttackTargetModal: (v) => setModalState({ sweepingAttackTargetModal: v }),
            setSecondaryTargetModal: (v) => setModalState({ secondaryTargetModal: v }),
            setModalState,
            buildCtx,
            buildCtxSync,
            proceedWithDamage,
            rollDamage,
            ...ctxOverrides,
        };

        // Add resolveAttackDamage to context for nested attacks (e.g., Stalker's Flurry)
        ctx.resolveAttackDamage = resolveAttackDamage;

        const pipeline = buildPipelineForAction(attack, playerStats);
        resumeRef.current = { pipelineStash: { pipeline, ctx } };
        await pipeline.run('housekeeping:do', ctx, resumeRef);
        if (resumeRef.current?._pausedStep) {
            applyPauseState(resumeRef.current);
        }
    };

    const applyPauseState = (paused) => {
            if (paused._modalType === 'cunningStrike') {
                // Modal already opened by the step via setAttackRiderModal.
                // Pipeline + ctx stay stashed until the modal closes and
                // resumeAttackPipeline() continues from 'cunning:checked'.
            } else if (paused._modalType === 'damageTypeChoice') {
                setModalState({ damageTypeChoice: paused._modalProps });
                setPendingDamage({
                    attack: paused.attack,
                    formula: paused.formula,
                    total: paused.total,
                    rolls: paused.rolls,
                    modifier: paused.modifier,
                    bonusExpr: paused.bonusExpr,
                    bonusTotal: paused.bonusTotal,
                    bonusRolls: paused.bonusRolls,
                    oncePerTurnKey: paused._weaponHitOnceKey,
                    _damageTypeModifier: paused._damageTypeModifier,
                });
            } else if (paused._modalType === 'divineFury') {
                setModalState({ divineFuryChoice: paused._modalProps });
                setPendingDamage({
                    attack: paused.attack,
                    formula: paused.formula,
                    total: paused.total,
                    rolls: paused.rolls,
                    modifier: paused.modifier,
                    bonusExpr: paused.bonusExpr,
                    bonusTotal: paused.bonusTotal,
                    bonusRolls: paused.bonusRolls,
                });
            } else if (paused._modalType === 'secondaryTarget') {
                setModalState({ secondaryTargetModal: paused._modalProps });
            } else if (paused._modalType === 'tacticalMaster') {
                // Route through the synced setter so the local mirror updates and
                // TacticalMasterModal renders, while still persisting the same
                // campaign.tacticalMasterPending key handleTacticalMasterConfirm reads.
                setTacticalMasterModal?.(paused._modalProps);
            } else if (paused._modalType === 'shieldBash') {
                setModalState({ shieldBashModal: paused._modalProps });
            }
    };

    /**
     * Resume a paused attack damage pipeline after a modal has resolved.
     * Continues from the event emitted by the paused step, so downstream
     * steps (sneak attack, damage application, etc.) execute normally.
     */
    const resumeAttackPipeline = async () => {
        const pausedStep = resumeRef.current?._pausedStep;
        const pausedModalType = resumeRef.current?._modalType;
        // FT-074/CLA-326: featureRiders-step modals pause BEFORE proceedToDamage,
        // so every such modal must carry its _modalType through this allow-list or
        // the triggering hit's weapon damage strands at the pause. Approved:
        // shieldBash (FT-074), stalkersFlurry (CLA-326). cantripBonuses keeps
        // its own flow.
        const approvedFeatureRidersPause = pausedStep === 'featureRiders'
            && (pausedModalType === 'shieldBash' || pausedModalType === 'stalkersFlurry');
        if (pausedStep !== 'cunningStrike' && pausedStep !== 'attackRiderManeuvers' && pausedStep !== 'tacticalMaster' && !approvedFeatureRidersPause) return;
        const stash = resumeRef.current?.pipelineStash;
        if (!stash) return;
        await stash.pipeline.resume(stash.ctx, resumeRef);
        if (!resumeRef.current?._pausedStep) return;
        applyPauseState(resumeRef.current);
    };

    const handleAttackRiderManeuverUse = async (maneuver, attack, popupHtmlData, currentFormula = null, currentTotal = 0, currentRolls = []) => {
        const maneuverName = maneuver?.name || maneuver;
        const attackInfo = {
            weaponType: attack.weaponType,
            isUnarmedStrike: attack.weaponType === 'unarmed',
            targetName: popupHtmlData?.targetName || null,
        };
        // MN-015: forward the Combat Superiority feature's save DC spec
        // (classes.json automation saveDc:'ability', saveAbility:['STR','DEX'])
        // so buildSaveDc resolves 8 + STR/DEX mod + PB instead of the DC-10 fallback.
        const superiorityInfo = [...(playerStats?.automation?.specialActions || []), ...(playerStats?.automation?.actions || [])]
            .find(a => a.type === 'combat_superiority');
        const action = {
            automation: {
                type: 'combat_superiority',
                saveDc: superiorityInfo?.saveDc ?? 'ability',
                saveAbility: superiorityInfo?.saveAbility || ['STR', 'DEX'],
            },
        };
        const result = await executeAttackRiderManeuverService(action, playerStats, campaignName, maneuverName, attackInfo);

        let updatedFormula = currentFormula;
        let updatedTotal = currentTotal;
        let updatedRolls = [...currentRolls];

        if (popupHtmlData?.isMiss && popupHtml) {
            if (maneuver && maneuver.effect === 'attack_roll_bonus') {
                return await handlePrecisionAttackMiss({ popupHtml, maneuver, currentFormula: updatedFormula, currentTotal: updatedTotal, currentRolls: updatedRolls, playerStats, resumeRef, setModalState, setPopupHtml, resumeAttackPipeline });
            }
        } else {
            return await applyRiderManeuverPostResolution({ result, maneuver, attack, popupHtmlData, attackInfo, playerStats, campaignName, setModalState, setPopupHtml, updatedFormula, updatedTotal, updatedRolls, resumeAttackPipeline });
        }

        return { formula: updatedFormula, total: updatedTotal, rolls: updatedRolls };
    };

    const handleAttackRiderManeuverSkip = () => {
        setModalState({ attackRiderManeuverPrompt: null });
        const stash = resumeRef.current?.pipelineStash;
        if (resumeRef.current?._pausedStep === 'attackRiderManeuvers' && stash?.ctx?.hit !== false) {
            resumeAttackPipeline();
        }
    };

    const handleAttackRiderOptionSelect = async (optionName, modalPayload) => {
        const { maneuver, targetName, description } = modalPayload;
        setModalState({ attackRiderOptionsModal: null });

        // Set brutal strike flags for damage step processing
        await setRuntimeValue(playerStats.name, '_brutalStrikeActive', true, campaignName);
        await setRuntimeValue(playerStats.name, '_brutalStrikeEffects', [optionName], campaignName);

        // Apply immediate effects (push, speed reduction, etc.)
        const option = maneuver.automation.options.find(o => o.name === optionName);
        let logDescription = description;
        if (option) {
            if (option.effect === 'push_15ft' && targetName) {
                const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                const newEffect = {
                    target: targetName,
                    source: playerStats.name,
                    option: optionName,
                    effect: 'push',
                    value: 15,
                    duration: 'instant',
                };
                setRuntimeValue('campaign', 'targetEffects', [...storedEffects, newEffect], campaignName);
                logDescription += ` ${targetName} pushed 15 feet.`;
            } else if (option.effect === 'speed_reduction' && targetName) {
                const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                const newEffect = {
                    target: targetName,
                    source: playerStats.name,
                    option: optionName,
                    effect: 'speed_reduction',
                    value: option.value || '15_ft_until_start_of_next_turn',
                    duration: 'until_start_of_next_turn',
                };
                setRuntimeValue('campaign', 'targetEffects', [...storedEffects, newEffect], campaignName);
                logDescription += ` ${targetName}'s speed reduced by 15 feet.`;
            }
        }

        setPopupHtml({ type: 'automation_info', name: maneuver.name, description: `${logDescription} Selected: ${optionName}.` });
    };

    return { resolveAttackDamage, resumeAttackPipeline, proceedWithDamage, handleAttackRiderManeuverUse, handleAttackRiderManeuverSkip, handleAttackRiderOptionSelect };
}
