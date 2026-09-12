import { rollExpression, rollExpressionDoubled, formatDamageFormula } from '../../../services/dice/diceRoller.js';
import { addEntry } from '../../../services/ui/logService.js';
import utils from '../../../services/ui/utils.js';
import { applyDamageToTarget, clearReTriggeredSequence } from '../../../services/rules/combat/applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { hasBardicInspirationOffense, getBardicInspirationDieSize, getBardicInspirationDieSizeFromClass } from '../../../services/combat/auras/bardicInspirationState.js';
import { hasEmpoweredSpell } from '../../../services/rules/spells/empoweredSpellService.js';
import { getChaModifier } from '../../../services/rules/spells/metamagicRules.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';
import { getHpThreshold, assignSecondaryFields, buildDamageBreakdownEntry, computeGwfAdjustedSecondaryTotal, findTargetByContext, resolveTargetMaxHp, resolveAppliedDamage } from './damageHandlerUtils.js';

const SECONDARY_LOG_SUFFIXES = ['Name', 'Formula', 'Rolls', 'Total', 'Modifier', 'DamageType', 'FinalDamage'];
const SECONDARY_POPUP_SUFFIXES = ['Name', 'Formula', 'Rolls', 'Total', 'Modifier', 'DamageType', 'FinalDamage'];

function applySentinelHalt(context, target, characterName, characters, campaignName) {
    const allFeatures = (() => {
        const playerCharacter = (characters || []).find(c => c.name === characterName || c.name.startsWith(characterName + ' '));
        const computed = playerCharacter?.computedStats || playerCharacter;
        return computed?.characterAdvancement || [];
    })();
    if (!allFeatures.some(f => f.name === 'Sentinel')) return;
    const sentinelStoredEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const newEffect = {
        target: target.name,
        source: 'Sentinel',
        option: 'Halt',
        effect: 'speed_zero',
        value: null,
        duration: 'end_of_turn',
    };
    setRuntimeValue('campaign', 'targetEffects', [...sentinelStoredEffects, newEffect], campaignName);
}

function rollRayOfEnfeebleReduction(attacker) {
    const rayTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const rayDebuffOnAttacker = rayTargetEffects.some(te => te.target === attacker && te.effect === 'ray_of_enfeeble_debuff');
    if (!rayDebuffOnAttacker) return { rayReduction: 0, rayOfEnfeebleRoll: null };
    const rayRoll = rollExpression('1d8');
    return { rayReduction: rayRoll?.total || 0, rayOfEnfeebleRoll: rayRoll?.total ?? null };
}

function rollResistanceReduction(target, damageType, campaignName) {
    const resTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const resEffectOnTarget = resTargetEffects.find(te => te.target === target?.name && te.effect === 'resistance_damage_reduction');
    const applies = resEffectOnTarget && damageType && resEffectOnTarget.chosenType?.toLowerCase() === damageType.toLowerCase();
    if (!applies) return { resistanceReduction: 0, resistanceRoll: null };
    if (getRuntimeValue(target?.name, 'resistanceUsedThisTurn', campaignName) === true) return { resistanceReduction: 0, resistanceRoll: null };
    const resRoll = rollExpression('1d4');
    const resistanceReduction = resRoll?.total || 0;
    setRuntimeValue(target?.name, 'resistanceUsedThisTurn', true, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: target?.name,
        abilityName: 'Resistance',
        description: `${target?.name} reduced damage by ${resistanceReduction} (1d4) via Resistance.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[resistance] Error:", e); });
    return { resistanceReduction, resistanceRoll: resRoll?.total ?? null };
}

function withRayReduction(applyResult, rayReduction) {
    return rayReduction > 0 ? { ...applyResult, rayOfEnfeebleReduction: rayReduction } : applyResult;
}

async function rollAndApplySecondaryDamage({ combatSummary, target, context, secondaryFormula, secondaryName, secondaryDamageType, damageSequenceId, campaignName, characters, characterName }) {
    const secondaryRollResult = context?.isAutoCrit ? rollExpressionDoubled(secondaryFormula) : rollExpression(secondaryFormula);
    if (!secondaryRollResult) return null;

    const secondaryTotal = computeGwfAdjustedSecondaryTotal(secondaryRollResult, context?.playerStats, secondaryDamageType);
    const secondaryRawDamage = secondaryTotal;
    const secondaryIgnoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, secondaryDamageType)) || false;
    const secondaryApplyResultData = await applyDamageToTarget(combatSummary, target.name, secondaryRawDamage, [secondaryDamageType], campaignName, characters, { ignoreResistance: secondaryIgnoreResistance, attackerName: characterName, suppressHpLog: true, damageSequenceId, skipConcentration: true });
    const secondaryFinalDamage = secondaryApplyResultData?.finalDamage ?? secondaryRawDamage;
    if (secondaryApplyResultData && secondaryApplyResultData.finalDamage > 0) {
        endInvisibilityOnHostileAction(characterName, campaignName);
    }
    const secondaryResult = {
        name: secondaryName,
        formula: secondaryFormula,
        rolls: secondaryRollResult.rolls,
        total: secondaryTotal,
        modifier: secondaryRollResult.modifier,
        damageType: secondaryDamageType,
        finalDamage: secondaryFinalDamage,
        resistanceDetails: secondaryApplyResultData?.resistanceDetails || [],
    };
    return { secondaryResult, secondaryFinalDamage };
}

async function rollAndApplySecondaryPlainDamage({ context, combatSummary, target, reducedTotal, damageType, ignoreResistance, rayReduction, characters, campaignName, characterName, name }) {
    if (!context?.autoDamageSecondaryFormula) {
        const primaryApplyResult = await applyDamageToTarget(combatSummary, target.name, reducedTotal, [damageType], campaignName, characters, { ignoreResistance: ignoreResistance, attackerName: characterName, suppressHpLog: true });
        return { applyResult: withRayReduction(primaryApplyResult, rayReduction), secondaryResult: null, secondaryFinalDamage: 0 };
    }
    const secondaryFormula = context.autoDamageSecondaryFormula;
    const secondaryName = context.autoDamageSecondaryName || name;
    const secondaryDamageType = context.autoDamageSecondaryDamageType;
    const damageSequenceId = `seq_${Date.now()}_${Math.random()}`;
    const secondaryOutcome = await rollAndApplySecondaryDamage({ combatSummary, target, context, secondaryFormula, secondaryName, secondaryDamageType, damageSequenceId, campaignName, characters, characterName });
    if (!secondaryOutcome) return { applyResult: null, secondaryResult: null, secondaryFinalDamage: 0 };

    const totalConcentrationDamage = reducedTotal + secondaryOutcome.secondaryResult.total;
    const primaryApplyResult = await applyDamageToTarget(combatSummary, target.name, reducedTotal, [damageType], campaignName, characters, { ignoreResistance: ignoreResistance, attackerName: characterName, suppressHpLog: true, damageSequenceId, concentrationTotalDamage: totalConcentrationDamage });
    clearReTriggeredSequence(damageSequenceId);
    return { applyResult: withRayReduction(primaryApplyResult, rayReduction), secondaryResult: secondaryOutcome.secondaryResult, secondaryFinalDamage: secondaryOutcome.secondaryFinalDamage };
}

function waitForSaveResult(promptId) {
    return new Promise(resolve => {
        const handler = (event) => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('save-result', handler);
            resolve(event.detail);
        };
        window.addEventListener('save-result', handler);
    });
}

async function resolveDeathStrike({ applyResult, context, combatSummary, target, characters, campaignName, characterName, adjustedTotal, formula, rolls, modifier, damageType, setPopupHtml, logEntry }) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const deathStrikeEffect = storedEffects.find(te => te.effect === 'death_strike' && te.target === target?.name);
    if (!deathStrikeEffect || !target) return applyResult;

    const dsSaveDc = deathStrikeEffect.saveDc;
    const dsSaveType = deathStrikeEffect.saveType;
    let dsApplyResult = null;
    if (dsSaveDc && dsSaveType) {
        const promptId = utils.guid();
        sendSavePrompt(campaignName, {
            promptId,
            targetName: target.name,
            saveType: dsSaveType,
            saveDc: dsSaveDc,
            dcSuccess: false,
            advantage: false,
            disadvantage: false,
        });
        const dsSaveResult = await waitForSaveResult(promptId);
        if (!dsSaveResult.success) {
            const doubledTotal = adjustedTotal * 2;
            const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

            logEntry({
                type: 'roll',
                characterName,
                rollType: 'save-damage',
                name: 'Death Strike',
                formula: `2× ${formula}`,
                rolls,
                total: doubledTotal,
                modifier,
                damageType,
                targetName: target.name,
                saveType: dsSaveType,
                saveDc: dsSaveDc,
                saveResult: dsSaveResult.success ? 'success' : 'failure',
                saveRoll: dsSaveResult.roll,
                saveBonus: dsSaveResult.bonus,
                saveRawRolls: dsSaveResult.rawRolls,
                finalDamage: null,
                note: 'death_strike_damage_roll_before_apply',
            });

            dsApplyResult = await applyDamageToTarget(combatSummary, target.name, doubledTotal, [damageType], campaignName, characters, { ignoreResistance: ignoreResistance || false, attackerName: characterName });
            if (!applyResult) {
                applyResult = dsApplyResult;
            }

            setPopupHtml(prev => ({
                ...prev,
                deathStrikeDoubled: true,
                deathStrikeSaveRoll: dsSaveResult.roll,
                deathStrikeSaveBonus: dsSaveResult.bonus,
                deathStrikeSaveDc: dsSaveDc,
                deathStrikeFinalDamage: dsApplyResult?.finalDamage,
            }));
        }
    }
    const cleanedEffects = storedEffects.filter(te => te.effect !== 'death_strike' || te.target !== target.name);
    setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName);
    return applyResult;
}

function applyRamProneCondition(target, campaignName, logEntry) {
    if (target.type === 'player') {
        const conditions = getRuntimeValue(target.name, 'activeConditions', campaignName) || [];
        if (Array.isArray(conditions) && !conditions.some(c => String(c).toLowerCase() === 'prone')) {
            setRuntimeValue(target.name, 'activeConditions', [...conditions, 'Prone'], campaignName);
        }
    } else {
        const conditions = getRuntimeValue(target.name, 'activeConditions') || [];
        if (!conditions.some(c => String(c).toLowerCase() === 'prone')) {
            setRuntimeValue(target.name, 'activeConditions', [...conditions, 'Prone'], campaignName);
        }
    }
    logEntry({
        type: 'condition',
        action: 'applied',
        characterName: target.name,
        condition: 'Prone',
        reason: 'Power of the Wilds (Ram)',
        timestamp: Date.now(),
    });
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

function resolveBardicInspirationFlags(context, characterName, campaignName) {
    const playerStats = context?.playerStats;
    return {
        offense: context?.bardicInspirationOffense || (playerStats ? hasBardicInspirationOffense(playerStats, campaignName) : false),
        dieSize: context?.bardicInspirationOffenseDieSize || getBardicInspirationDieSize(characterName, campaignName) || (playerStats ? getBardicInspirationDieSizeFromClass(playerStats) : null),
    };
}

function resolveEmpoweredSpellFlags(context) {
    const playerStats = context?.playerStats;
    return {
        empoweredSpell: context?.empoweredSpell || (playerStats ? hasEmpoweredSpell(playerStats) : false),
        empoweredSpellChaMod: context?.empoweredSpellChaMod || getChaModifier(playerStats),
    };
}

function attachInspirationEmpoweredFlags(popupData, context, characterName, campaignName) {
    const bardic = resolveBardicInspirationFlags(context, characterName, campaignName);
    const empowered = resolveEmpoweredSpellFlags(context);
    popupData.bardicInspirationOffense = bardic.offense;
    popupData.bardicInspirationOffenseDieSize = bardic.dieSize;
    popupData.empoweredSpell = empowered.empoweredSpell;
    popupData.empoweredSpellChaMod = empowered.empoweredSpellChaMod;
    popupData.spellName = context?.spellName || '';
}

function attachPiercerFlag(popupData, context, characterName, campaignName) {
    // Check for Piercer - Puncture availability
    const isPiercing = (popupData.damageType || '').toLowerCase() === 'piercing';
    const hasPiercerFeat = context?.playerStats?.reactions?.some(r =>
        r.automation?.type === 'piercer_puncture'
    ) || false;
    const punctureUsed = hasPiercerFeat ? getRuntimeValue(characterName, 'piercerPunctureUsedThisTurn', campaignName) : false;
    popupData.piercerPuncture = isPiercing && hasPiercerFeat && !punctureUsed;
}

function resolveWeaponTypeFlags(context) {
    // Determine weapon type for popup
    const isUnarmedStrike = context?.isUnarmedStrike || false;
    const isMelee = context?.isMelee != null ? context.isMelee : (context?.damageType === 'ranged' ? false : true);
    return { isUnarmedStrike, isMelee };
}

function attachSavageAttackerFlag(popupData, context, characterName, campaignName, isMelee, isUnarmedStrike) {
    // Check for Savage Attacker availability
    const hasSavageAttacker = context?.playerStats?.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === 'reroll_damage_once_per_turn') || false;
    const isMeleeOrUnarmed = (isMelee || isUnarmedStrike);
    const saUsed = hasSavageAttacker ? getRuntimeValue(characterName, '_Savage_Attacker_usedRound', campaignName) : false;
    popupData.savageAttacker = hasSavageAttacker && isMeleeOrUnarmed && !saUsed;
}

function attachPopupFeatureFlags(popupData, context, characterName, campaignName) {
    attachInspirationEmpoweredFlags(popupData, context, characterName, campaignName);
    attachPiercerFlag(popupData, context, characterName, campaignName);
    const { isUnarmedStrike, isMelee } = resolveWeaponTypeFlags(context);
    popupData.weaponType = isUnarmedStrike ? 'unarmed' : (isMelee ? 'melee' : 'ranged');
    attachSavageAttackerFlag(popupData, context, characterName, campaignName, isMelee, isUnarmedStrike);
}

async function applyDamageForTarget({ context, target, combatSummary, characters, campaignName, characterName, attackerName, damageType, adjustedTotal, name }) {
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName) || null;
    const attackHit = context?.isOpportunityAttack && lastAttack?.hit === true && lastAttack?.attackerName === characterName;
    if (attackHit) {
        applySentinelHalt(context, target, characterName, characters, campaignName);
    }
    const attacker = attackerName || characterName;
    const { rayReduction, rayOfEnfeebleRoll } = rollRayOfEnfeebleReduction(attacker);
    const { resistanceReduction, resistanceRoll } = rollResistanceReduction(target, damageType, campaignName);
    const reducedTotal = Math.max(0, adjustedTotal - rayReduction - resistanceReduction);
    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

    const { applyResult, secondaryResult, secondaryFinalDamage } = await rollAndApplySecondaryPlainDamage({
        context, combatSummary, target, reducedTotal, damageType, ignoreResistance, rayReduction, characters, campaignName, characterName, name,
    });
    return { applyResult, secondaryResult, secondaryFinalDamage, reducedTotal, rayReduction, rayOfEnfeebleRoll, resistanceReduction, resistanceRoll };
}

function resolveCurrentHp(target) {
    if (!target) return 0;
    return target.type === 'player' ? (getRuntimeValue(target.name, 'currentHitPoints') ?? target.currentHp) : target.currentHp;
}

function buildPlainDamageLogData({ characterName, name, modifier, formula, rolls, displayRolls, gwfBaseRolls, gwfDisplayRolls, target, damageType, adjustedTotal, appliedDamage, reducedTotal, isCrit, rayReduction, rayOfEnfeebleRoll, resistanceReduction, resistanceRoll }) {
    return {
        type: 'roll',
        characterName,
        rollType: 'damage',
        name,
        formula: isCrit ? formatDamageFormula(formula, rolls, true) : formula,
        rolls: displayRolls,
        total: adjustedTotal,
        modifier,
        damageType,
        targetName: target?.name,
        finalDamage: appliedDamage || reducedTotal,
        note: 'combined_damage_roll',
        isCrit,
        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
        gwfDisplayRolls: gwfDisplayRolls,
        rayOfEnfeebleReduction: rayReduction,
        rayOfEnfeebleRoll: rayOfEnfeebleRoll,
        resistanceReduction,
        resistanceRoll,
    };
}

function buildPlainPopupData({ name, formula, rolls, modifier, context, target, damageType, adjustedTotal, total, isCrit, gwfBaseRolls, gwfDisplayRolls, rayReduction, rayOfEnfeebleRoll, resistanceReduction, resistanceRoll }) {
    return {
        type: 'damage',
        name,
        formula,
        rolls,
        bonus: 0,
        modifier,
        dc: context?.dc,
        dcType: context?.dcType,
        dcSuccess: context?.dcSuccess,
        damageType,
        targetName: target?.name,
        total: adjustedTotal,
        adjustedTotal: adjustedTotal,
        elementalAdeptBonus: adjustedTotal > total ? adjustedTotal - total : 0,
        isCrit,
        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
        gwfDisplayRolls: gwfDisplayRolls,
        tavernBrawlerRerolls: context?.tavernBrawlerRerolls || null,
        rayOfEnfeebleReduction: rayReduction,
        rayOfEnfeebleRoll: rayOfEnfeebleRoll,
        resistanceReduction,
        resistanceRoll,
    };
}

function applyPopupApplyResult(popupData, { applyResult, appliedDamage, targetMaxHp, isIntercepted }) {
    if (!applyResult) return;
    popupData.targetCurrentHp = applyResult.newHp;
    popupData.targetMaxHp = targetMaxHp;
    popupData.damageApplied = true;
    popupData.finalDamage = appliedDamage || applyResult.finalDamage;
    popupData.damageReduced = applyResult.damageReduced;
    if (isIntercepted) {
        popupData.interceptedFeature = applyResult.interceptedFeature;
    }
    if (applyResult.holyAuraSaveResult) {
        popupData.holyAuraSaveResult = applyResult.holyAuraSaveResult;
    }
}

// Store damage rolls for later access (e.g., Piercer feat) — merge into existing lastAttack
async function storeDamageLastAttack({ context, campaignName, target, damageType, adjustedTotal, displayRolls, applyResult }) {
    const { attackerName, targetName, attackName, spellName, statusEffects, affectedTargets } = context || {};
    const existingLastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName) || {};
    setRuntimeValue('campaign', 'lastAttack', {
        ...existingLastAttack,
        // Always populate from context to ensure attack-based spells have these fields
        // even if the attack roll SSE hasn't arrived yet
        attackerName: attackerName || existingLastAttack.attackerName,
        targetName: targetName || existingLastAttack.targetName,
        attackName: attackName || spellName || existingLastAttack.attackName,
        rolls: displayRolls,
        rawDamage: adjustedTotal,
        primaryDamage: adjustedTotal,
        primaryDamageType: damageType,
        damageTypes: [damageType],
        actualDamage: applyResult?.finalDamage ?? adjustedTotal,
        damageApplied: true,
        statusEffects: statusEffects || null,
        affectedTargets: affectedTargets || [target?.name].filter(Boolean),
    }, campaignName);
}

async function handleTwinPlainTarget({ combatSummary, context, target, campaignName, characterName, characters, name, formula, modifier, damageType, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls, setPopupHtml, logEntry }) {
    const twinTarget = combatSummary?.creatures?.find(c => c.name === context.metamagicTwinTarget);
    if (!twinTarget || twinTarget.name === target.name) return;

    logEntry({
        type: 'roll',
        characterName,
        rollType: 'damage',
        name: `${name} (Twinned)`,
        formula,
        rolls: displayRolls,
        total: adjustedTotal,
        modifier,
        damageType,
        targetName: twinTarget.name,
        finalDamage: null,
        note: 'twin_damage_roll_before_apply',
        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
        gwfDisplayRolls: gwfDisplayRolls,
    });

    const twinApplyResult = await applyDamageToTarget(combatSummary, twinTarget.name, adjustedTotal, [damageType], campaignName, characters, { ignoreResistance: false, attackerName: characterName });

    if (twinApplyResult && twinApplyResult.finalDamage > 0) {
        endInvisibilityOnHostileAction(characterName, campaignName);
    }
    setPopupHtml(prev => ({
        ...prev,
        twinTargetName: twinTarget.name,
        twinFinalDamage: twinApplyResult?.finalDamage,
        twinTargetCurrentHp: twinApplyResult?.newHp,
        twinTargetMaxHp: twinTarget.type === 'player'
            ? (getRuntimeValue(twinTarget.name, 'hitPoints') ?? 0)
            : twinTarget.maxHp,
    }));
}

async function handleMultiPlainTarget({ combatSummary, context, target, campaignName, characterName, name, formula, modifier, damageType, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls, setPopupHtml, logEntry }) {
    const multiTarget = combatSummary?.creatures?.find(c => c.name === context.multiTarget);
    if (!multiTarget || multiTarget.name === target.name) return;

    logEntry({
        type: 'roll',
        characterName,
        rollType: 'damage',
        name: `${name} (Words of Creation)`,
        formula,
        rolls: displayRolls,
        total: adjustedTotal,
        modifier,
        damageType,
        targetName: multiTarget.name,
        finalDamage: null,
        note: 'multi_damage_roll_before_apply',
        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
        gwfDisplayRolls: gwfDisplayRolls,
    });

    const multiApplyResult = await applyDamageToTarget(combatSummary, multiTarget.name, adjustedTotal, [damageType], campaignName, null, { ignoreResistance: false, attackerName: characterName });

    setPopupHtml(prev => ({
        ...prev,
        twinTargetName: multiTarget.name,
        twinFinalDamage: multiApplyResult?.finalDamage,
        twinTargetCurrentHp: multiApplyResult?.newHp,
        twinTargetMaxHp: multiTarget.type === 'player'
            ? (getRuntimeValue(multiTarget.name, 'hitPoints') ?? 0)
            : multiTarget.maxHp,
    }));
}

function maybeApplyRamProne({ context, target, applyResult, campaignName, logEntry }) {
    if (!(context?.ramActive && context?.isMelee && target && applyResult)) return;
    const isLargeOrSmaller = !target.size || ['Tiny', 'Small', 'Medium', 'Large'].includes(target.size);
    if (!isLargeOrSmaller) return;
    applyRamProneCondition(target, campaignName, logEntry);
}

function attachPopupHpFallbacks(popupData, target, targetMaxHp) {
    popupData.targetCurrentHp = popupData.targetCurrentHp || (target?.type === 'player' ? (getRuntimeValue(target.name, 'hitPoints') ?? 0) : (target?.currentHp ?? target?.maxHp));
    popupData.targetMaxHp = popupData.targetMaxHp || targetMaxHp;
}

function writePlainHpResults({ campaignName, target, totalDamageDealt, hpAfterDamage, maxHp, isUnconscious, threshold, damageBreakdown, newHp, oldHp }) {
    const hpEntry = {
        type: 'hp_change',
        targetName: target?.name,
        delta: -(totalDamageDealt),
        currentHp: hpAfterDamage,
        maxHp,
        isHealing: false,
        isUnconscious: isUnconscious,
        damageBreakdown,
    };
    if (threshold) hpEntry.threshold = threshold;
    addEntry(campaignName, hpEntry).catch((e) => { console.error("[useLoggedDiceRollDamage] Error:", e); });

    if (target?.type === 'player') {
        setRuntimeValue(target.name, 'currentHitPoints', newHp, campaignName);
        if (oldHp > 0 && isUnconscious) {
            setRuntimeValue(target.name, 'deathSaves', [false, false, false], campaignName);
            setRuntimeValue(target.name, 'deathFailures', [false, false, false], campaignName);
        }
    }
}

function buildDamageBreakdown(applyResult, secondaryResult, damageType, appliedDamage, reducedTotal) {
    const damageBreakdown = [buildDamageBreakdownEntry(applyResult, damageType, appliedDamage || reducedTotal)];
    if (secondaryResult) {
        damageBreakdown.push(buildDamageBreakdownEntry(secondaryResult, secondaryResult.damageType, secondaryResult.finalDamage));
    }
    return damageBreakdown;
}

async function runFollowupTargets({ context, combatSummary, target, campaignName, characterName, characters, name, formula, modifier, damageType, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls, setPopupHtml, logEntry }) {
    if (!target) return;
    if (context?.metamagicTwinTarget) {
        await handleTwinPlainTarget({ combatSummary, context, target, campaignName, characterName, characters, name, formula, modifier, damageType, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls, setPopupHtml, logEntry });
    }
    if (context?.multiTarget) {
        await handleMultiPlainTarget({ combatSummary, context, target, campaignName, characterName, name, formula, modifier, damageType, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls, setPopupHtml, logEntry });
    }
}

function computeDamageOutcome({ applyResult, isIntercepted, appliedDamage, secondaryFinalDamage, target }) {
    const totalDamageDealt = appliedDamage + secondaryFinalDamage;
    const newHp = applyResult?.newHp ?? resolveCurrentHp(target);
    const hpAfterDamage = isIntercepted ? 0 : newHp;
    const oldHp = isIntercepted ? applyResult.oldHp : (newHp + totalDamageDealt);
    const isUnconscious = hpAfterDamage <= 0;
    const maxHp = target?.type === 'player'
        ? (getRuntimeValue(target.name, 'hitPoints') ?? newHp)
        : target?.maxHp;
    const threshold = getHpThreshold({ oldHp, newHp, maxHp, deadHp: hpAfterDamage });
    return { totalDamageDealt, newHp, hpAfterDamage, oldHp, isUnconscious, maxHp, threshold };
}

export function createPlainDamageHandler(deps) {
    const { characterName, campaignName, characters, setPopupHtml, logEntry } = deps;

    return async function handlePlainDamage({ name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls }) {
        const { damageType, attackerName } = context || {};
        const target = findTargetByContext(combatSummary, context);
        const targetMaxHp = resolveTargetMaxHp(target);

        let applyResult = null;
        let secondaryResult = null;
        let secondaryFinalDamage = 0;
        let reducedTotal = 0;
        let rayReduction = 0;
        let rayOfEnfeebleRoll = null;
        let resistanceReduction = 0;
        let resistanceRoll = null;

        if (target) {
            ({ applyResult, secondaryResult, secondaryFinalDamage, reducedTotal, rayReduction, rayOfEnfeebleRoll, resistanceReduction, resistanceRoll } = await applyDamageForTarget({
                context, target, combatSummary, characters, campaignName, characterName, attackerName, damageType, adjustedTotal, name,
            }));
        }

        const isIntercepted = applyResult?.intercepted;
        const appliedDamage = resolveAppliedDamage(applyResult, isIntercepted);

        if (appliedDamage > 0) {
            endInvisibilityOnHostileAction(characterName, campaignName);
        }

        const { totalDamageDealt, newHp, hpAfterDamage, oldHp, isUnconscious, maxHp, threshold } = computeDamageOutcome({ applyResult, isIntercepted, appliedDamage, secondaryFinalDamage, target });

        const isCrit = context?.isAutoCrit || false;

        const logEntryData = buildPlainDamageLogData({ characterName, name, modifier, formula, rolls, displayRolls, gwfBaseRolls, gwfDisplayRolls, target, damageType, adjustedTotal, appliedDamage, reducedTotal, isCrit, rayReduction, rayOfEnfeebleRoll, resistanceReduction, resistanceRoll });
        assignSecondaryFields(logEntryData, secondaryResult, SECONDARY_LOG_SUFFIXES);
        logEntry(logEntryData);

        const damageBreakdown = buildDamageBreakdown(applyResult, secondaryResult, damageType, appliedDamage, reducedTotal);

        writePlainHpResults({ campaignName, target, totalDamageDealt, hpAfterDamage, maxHp, isUnconscious, threshold, damageBreakdown, newHp, oldHp });

        applyResult = await resolveDeathStrike({ applyResult, context, combatSummary, target, characters, campaignName, characterName, adjustedTotal, formula, rolls, modifier, damageType, setPopupHtml, logEntry });

        maybeApplyRamProne({ context, target, applyResult, campaignName, logEntry });

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);

        const popupData = buildPlainPopupData({ name, formula, rolls, modifier, context, target, damageType, adjustedTotal, total, isCrit, gwfBaseRolls, gwfDisplayRolls, rayReduction, rayOfEnfeebleRoll, resistanceReduction, resistanceRoll });

        assignSecondaryFields(popupData, secondaryResult, SECONDARY_POPUP_SUFFIXES);

        attachPopupHpFallbacks(popupData, target, targetMaxHp);

        applyPopupApplyResult(popupData, { applyResult, appliedDamage, targetMaxHp, isIntercepted });

        attachPopupFeatureFlags(popupData, context, characterName, campaignName);

        setPopupHtml(popupData);

        if (popupData.rolls && popupData.damageType) {
            await storeDamageLastAttack({ context, campaignName, target, damageType, adjustedTotal, displayRolls, applyResult });
        }

        await runFollowupTargets({ context, combatSummary, target, campaignName, characterName, characters, name, formula, modifier, damageType, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls, setPopupHtml, logEntry });
    };
}
