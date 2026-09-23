import { rollExpression, rollExpressionDoubled, parseConstant, formatDamageFormula } from '../../../services/dice/diceRoller.js';
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
import { registerTargetEffect, getEffectDefinition } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';
import { consumePendingRedirectOnResolve } from '../../../services/encounters/monsterRedirectAttack.js';
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

// MA-0102: Weakening Breath (Adult Gold Dragon) — the afflicted attacker
// subtracts its te's damageSubtractDie (1d6) from its damage rolls until the
// effect ends (repeat-save success or 1-minute auto-success). Mirrors the ray
// reduction seam; rolls once per damage roll while the te stands.
function rollWeakeningBreathReduction(attacker) {
    const tes = getRuntimeValue('campaign', 'targetEffects') || [];
    const te = tes.find(t => t.target === attacker && t.effect === 'weakening_breath');
    if (!te) return { weakeningReduction: 0, weakeningBreathRoll: null };
    const roll = rollExpression(te.damageSubtractDie || '1d6');
    return { weakeningReduction: roll?.total || 0, weakeningBreathRoll: roll?.total ?? null };
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

// MA-0530: flat_damage_secondary constant ("1") has no dice to roll —
// resolve verbatim dice-less (MA-0322 lineage); flat NEVER doubles on crit —
// rollExpressionDoubled returns null for constants (CLA-281).
function resolveSecondaryRoll(secondaryFormula, isAutoCrit) {
    const rolled = isAutoCrit ? rollExpressionDoubled(secondaryFormula) : rollExpression(secondaryFormula);
    if (rolled) return rolled;
    const flat = parseConstant(secondaryFormula);
    return flat != null ? { total: flat, rolls: [], modifier: 0 } : null;
}

async function rollAndApplySecondaryDamage({ combatSummary, target, context, secondaryFormula, secondaryName, secondaryDamageType, damageSequenceId, campaignName, characters, characterName }) {
    const secondaryRollResult = resolveSecondaryRoll(secondaryFormula, context?.isAutoCrit);
    if (!secondaryRollResult) return null;

    const secondaryTotal = computeGwfAdjustedSecondaryTotal(secondaryRollResult, context?.playerStats, secondaryDamageType);
    const secondaryRawDamage = secondaryTotal;
    const secondaryIgnoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, secondaryDamageType)) || false;
    const secondaryApplyResultData = await applyDamageToTarget(combatSummary, target.name, secondaryRawDamage, [secondaryDamageType], { campaignName, characters: characters, ignoreResistance: secondaryIgnoreResistance, attackerName: characterName, suppressHpLog: true, damageSequenceId, skipConcentration: true });
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

// MA-0889: advantage-gated secondary rider (Goblin Boss Scimitar/Shortbow —
// "plus 1d4 … if the attack roll had Advantage"). The rider fires ONLY when
// the attack was resolved with Advantage, read honestly from the campaign
// lastAttack.forcedMode stamp the attack resolver writes post-roll
// (storeCampaignLastAttack — the same channel the advantage-rig te
// `next_attack_advantage` lands on, forcedMode:"advantage", incl. Restore
// Balance cancellation). No advantage → rider skipped, primary-only damage,
// honest `secondary_damage_skipped` log. Rows without the discriminator
// (null) — the MA-0426/0531 additive-rider family — stay byte-identical
// always-roll.
function secondaryRiderBlockedByAdvantageGate(context, lastAttack) {
    return context?.secondaryCondition === 'advantage' && lastAttack?.forcedMode !== 'advantage';
}

async function rollAndApplySecondaryPlainDamage({ context, combatSummary, target, reducedTotal, damageType, ignoreResistance, rayReduction, characters, campaignName, characterName, name, lastAttack }) {
    if (!context?.autoDamageSecondaryFormula) {
        const primaryApplyResult = await applyDamageToTarget(combatSummary, target.name, reducedTotal, [damageType], { campaignName, characters: characters, ignoreResistance: ignoreResistance, attackerName: characterName, suppressHpLog: true });
        return { applyResult: withRayReduction(primaryApplyResult, rayReduction), secondaryResult: null, secondaryFinalDamage: 0 };
    }
    const secondaryFormula = context.autoDamageSecondaryFormula;
    const secondaryName = context.autoDamageSecondaryName || name;
    if (secondaryRiderBlockedByAdvantageGate(context, lastAttack)) {
        addEntry(campaignName, {
            type: 'automation',
            automationType: 'secondary_damage_skipped',
            characterName: characterName,
            abilityName: secondaryName,
            targetName: target?.name || null,
            reason: 'no advantage',
            description: `${secondaryName} rider skipped — the attack roll did not have Advantage; primary damage only.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[MA-0889] Error logging secondary damage skip:', e); });
        const primaryApplyResult = await applyDamageToTarget(combatSummary, target.name, reducedTotal, [damageType], { campaignName, characters: characters, ignoreResistance: ignoreResistance, attackerName: characterName, suppressHpLog: true });
        return { applyResult: withRayReduction(primaryApplyResult, rayReduction), secondaryResult: null, secondaryFinalDamage: 0 };
    }
    const secondaryDamageType = context.autoDamageSecondaryDamageType;
    const damageSequenceId = `seq_${Date.now()}_${Math.random()}`;
    const secondaryOutcome = await rollAndApplySecondaryDamage({ combatSummary, target, context, secondaryFormula, secondaryName, secondaryDamageType, damageSequenceId, campaignName, characters, characterName });
    if (!secondaryOutcome) return { applyResult: null, secondaryResult: null, secondaryFinalDamage: 0 };

    const totalConcentrationDamage = reducedTotal + secondaryOutcome.secondaryResult.total;
    const primaryApplyResult = await applyDamageToTarget(combatSummary, target.name, reducedTotal, [damageType], { campaignName, characters: characters, ignoreResistance: ignoreResistance, attackerName: characterName, suppressHpLog: true, damageSequenceId, concentrationTotalDamage: totalConcentrationDamage });
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

            dsApplyResult = await applyDamageToTarget(combatSummary, target.name, doubledTotal, [damageType], { campaignName, characters: characters, ignoreResistance: ignoreResistance || false, attackerName: characterName });
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

function attachSavageAttackerFlag(popupData, context, characterName, campaignName, { isMelee, isUnarmedStrike }) {
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
    attachSavageAttackerFlag(popupData, context, characterName, campaignName, { isMelee, isUnarmedStrike });
}

async function applyDamageForTarget({ context, target, combatSummary, characters, campaignName, characterName, attackerName, damageType, adjustedTotal, name }) {
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName) || null;
    const attackHit = context?.isOpportunityAttack && lastAttack?.hit === true && lastAttack?.attackerName === characterName;
    if (attackHit) {
        applySentinelHalt(context, target, characterName, characters, campaignName);
    }
    const attacker = attackerName || characterName;
    const { rayReduction, rayOfEnfeebleRoll } = rollRayOfEnfeebleReduction(attacker);
    const { weakeningReduction, weakeningBreathRoll } = rollWeakeningBreathReduction(attacker);
    const { resistanceReduction, resistanceRoll } = rollResistanceReduction(target, damageType, campaignName);
    const reducedTotal = Math.max(0, adjustedTotal - rayReduction - weakeningReduction - resistanceReduction);
    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

    const { applyResult, secondaryResult, secondaryFinalDamage } = await rollAndApplySecondaryPlainDamage({
        context, combatSummary, target, reducedTotal, damageType, ignoreResistance, rayReduction, characters, campaignName, characterName, name, lastAttack,
    });
    return { applyResult, secondaryResult, secondaryFinalDamage, reducedTotal, rayReduction, rayOfEnfeebleRoll, weakeningReduction, weakeningBreathRoll, resistanceReduction, resistanceRoll };
}

function resolveCurrentHp(target) {
    if (!target) return 0;
    return target.type === 'player' ? (getRuntimeValue(target.name, 'currentHitPoints') ?? target.currentHp) : target.currentHp;
}

function buildPlainDamageLogData({ characterName, name, modifier, formula, rolls, displayRolls, gwfBaseRolls, gwfDisplayRolls, target, damageType, adjustedTotal, appliedDamage, reducedTotal, isCrit, rayReduction, rayOfEnfeebleRoll, weakeningReduction, weakeningBreathRoll, resistanceReduction, resistanceRoll }) {
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
        weakeningBreathReduction: weakeningReduction || 0,
        weakeningBreathRoll: weakeningBreathRoll ?? null,
        resistanceReduction,
        resistanceRoll,
    };
}

function buildPlainPopupData({ name, formula, rolls, modifier, context, target, damageType, adjustedTotal, total, isCrit, gwfBaseRolls, gwfDisplayRolls, rayReduction, rayOfEnfeebleRoll, weakeningReduction, weakeningBreathRoll, resistanceReduction, resistanceRoll }) {
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
        weakeningBreathReduction: weakeningReduction || 0,
        weakeningBreathRoll: weakeningBreathRoll ?? null,
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

    const twinApplyResult = await applyDamageToTarget(combatSummary, twinTarget.name, adjustedTotal, [damageType], { campaignName, characters: characters, ignoreResistance: false, attackerName: characterName });

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

    const multiApplyResult = await applyDamageToTarget(combatSummary, multiTarget.name, adjustedTotal, [damageType], { campaignName, characters: null, ignoreResistance: false, attackerName: characterName });

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

// MA-0553: monsters.json sizes include ranges ("Medium or Small" — Bandit);
// a plain includes() silently swallowed every hit-clause on such victims.
// Gate on the LARGEST size named; unknown sizes stay lenient.
function isLargeOrSmallerTarget(size) {
    if (!size) return true;
    const order = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
    const parts = String(size).split(/\s+or\s+/i).map(s => s.trim());
    let largest = 0;
    for (const part of parts) {
        const idx = order.indexOf(part);
        if (idx === -1) return false;
        if (idx > largest) largest = idx;
    }
    return largest <= order.indexOf('Large');
}

function maybeApplyRamProne({ context, target, applyResult, campaignName, logEntry }) {
    if (!(context?.ramActive && context?.isMelee && target && applyResult)) return;
    if (!isLargeOrSmallerTarget(target.size)) return;
    applyRamProneCondition(target, campaignName, logEntry);
}

// MA-0010: monster attack-hit conditions (monsters.json hit_conditions +
// escape_dc, e.g. Aberrant Cultist Tentacle Lash → Grappled/Restrained).
// Applied on the resolved hit via the canonical activeConditions write path,
// with activeConditionMeta {dc, ability} so the target's condition badge
// (CharConditions) offers the escape save. Escape is a badge click —
// GM-enforced re-save; no token/movement grapple subsystem.
function applyHitClauseConditions({ hitClause, target, campaignName, logEntry, attackerName }) {
    const currentConditions = getRuntimeValue(target.name, 'activeConditions', campaignName) || [];
    const newConditions = [...currentConditions];
    for (const cond of hitClause.conditions) {
        if (!newConditions.some(c => String(c).toLowerCase() === cond)) {
            newConditions.push(cond);
        }
    }
    setRuntimeValue(target.name, 'activeConditions', newConditions, campaignName);
    // MA-0019 provenance: always stamp the inflicting creature into meta
    // (escape dc/ability ride along when authored) so "by <source>"
    // prerequisites can be enforced. Additive for existing dc consumers.
    const existingMeta = getRuntimeValue(target.name, 'activeConditionMeta', campaignName) || {};
    const newMeta = { ...existingMeta };
    for (const cond of hitClause.conditions) {
        newMeta[cond] = { ...(existingMeta[cond] || {}), source: attackerName };
        if (hitClause.escapeDc != null) {
            newMeta[cond].dc = hitClause.escapeDc;
            newMeta[cond].ability = 'str';
        }
    }
    setRuntimeValue(target.name, 'activeConditionMeta', newMeta, campaignName);
    const conditionLabels = hitClause.conditions.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
    logEntry({
        type: 'condition',
        action: 'applied',
        characterName: target.name,
        condition: conditionLabels,
        reason: hitClause.reasonOverride || `${hitClause.attackName} (escape DC ${hitClause.escapeDc ?? '—'})`,
        note: hitClause.escapeDc != null
            ? `${target.name} is held by a tentacle — escape via the condition badge save (DC ${hitClause.escapeDc}, STR); Restrained lasts until the grapple ends.`
            : null,
        timestamp: Date.now(),
    });
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

// MA-0575: random-condition rider (Death Slaad Chaos Blade — "a condition
// determined by rolling 1d4: 1 Charmed; 2 Frightened; 3 Poisoned; 4
// Incapacitated" until the slaad's next turn). Rolls the authored die via
// the existing rollExpression seam on the resolved hit, logs the die value
// transparently, and returns the chosen standard condition (no fabricated
// per-condition mechanics — grant is stamp + meta source + log only).
function rollHitConditionChoice({ hitClause, targetName, logEntry, attackerName }) {
    const { die, conditions } = hitClause.conditionRoll;
    const roll = rollExpression(`1d${die}`);
    const value = roll?.rolls?.[0] ?? roll?.total;
    if (!Number.isInteger(value) || value < 1 || value > conditions.length) {
        console.error(`[MA-0575] Chaos condition roll failed for ${hitClause.attackName}: 1d${die} →`, value);
        return null;
    }
    const condition = conditions[value - 1];
    const label = condition.charAt(0).toUpperCase() + condition.slice(1);
    logEntry({
        type: 'roll',
        characterName: attackerName,
        rollType: 'chaos-condition',
        name: hitClause.attackName,
        formula: `1d${die}`,
        rolls: [value],
        total: value,
        targetName,
        description: `1d${die} → ${value} → ${label}`,
        timestamp: Date.now(),
    });
    return { condition, label };
}

function maybeApplyHitClause({ context, target, applyResult, campaignName, logEntry, characterName }) {
    const hitClause = context?.hitClause;
    if (!hitClause || !target || !applyResult) return;
    if (!isLargeOrSmallerTarget(target.size)) return;
    let effectiveClause = hitClause;
    let riderChoice = null;
    if (hitClause.conditionRoll) {
        riderChoice = rollHitConditionChoice({ hitClause, targetName: target.name, logEntry, attackerName: characterName });
        if (riderChoice) {
            effectiveClause = {
                ...hitClause,
                conditions: [riderChoice.condition],
                reasonOverride: `${hitClause.attackName} — 1d${hitClause.conditionRoll.die} rolled ${hitClause.conditionRoll.conditions.indexOf(riderChoice.condition) + 1} → ${riderChoice.label}; until the start of ${characterName}'s next turn`,
            };
        }
    }
    const hasConditions = Array.isArray(effectiveClause.conditions) && effectiveClause.conditions.length > 0;
    if (!hasConditions && !hitClause.targetEffect) return;
    if (hasConditions) {
        applyHitClauseConditions({ hitClause: effectiveClause, target, campaignName, logEntry, attackerName: characterName });
    }
    if (riderChoice) {
        addExpiration({
            attackerName: characterName,
            targetName: target.name,
            effects: [{ type: 'condition', condition: riderChoice.condition, source: characterName }],
            campaignName,
            rounds: undefined,
            expireOnCreatureName: characterName,
        });
    }
    if (hitClause.targetEffect) {
        applyHitClauseTargetEffect({ hitClause, target, attackerName: characterName, campaignName, logEntry });
    }
}

// MA-0016: Aberrant Spirit (Slaad) Claw — "the target can't regain Hit
// Points until the start of the spirit's next turn". Registers the
// registered 'no_healing' te on the target (registry:
// targetEffectDefinitions.js; consumed by applyHealingToTarget /
// applyHealingDirectly via healingBlock.js) and expires it anchored on the
// spirit (attacker) — fires at the spirit's NEXT turn start (stepOfTheWind
// until_start_of_next_turn + CLA-345 expireOnCreatureName pattern).
function applyHitClauseTargetEffect({ hitClause, target, attackerName, campaignName, logEntry }) {
    const def = getEffectDefinition(hitClause.targetEffect);
    registerTargetEffect(campaignName, target.name, hitClause.targetEffect, attackerName, {
        duration: 'until_start_of_next_turn',
    });
    addExpiration({
        attackerName,
        targetName: target.name,
        effects: [{ type: 'remove_target_effect', effectKey: hitClause.targetEffect, source: attackerName, target: target.name }],
        campaignName,
        rounds: undefined,
        expireOnCreatureName: attackerName,
    });
    logEntry({
        type: 'condition',
        action: 'applied',
        characterName: target.name,
        condition: def?.label || hitClause.targetEffect,
        reason: `${hitClause.attackName} — until the start of ${attackerName}'s next turn`,
        note: hitClause.targetEffect === 'no_healing'
            ? `Healing blocked for ${target.name} (GM-enforced for direct-HP writes: turn-start ticks, rests, initiative-card HP edits).`
            : `${def?.description || hitClause.targetEffect} applied to ${target.name} (anchor expiry fires at ${attackerName}'s next turn start; RAW end-of-turn anchor is advisory).`,
        timestamp: Date.now(),
    });
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
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
        // MA-0891: Goblin Boss Redirect Attack resolve consumer — when a
        // stamped pendingRedirect matches this attack (attacker identity,
        // not yet consumed), the victim is honestly rewritten to the armed
        // ALLY before any target lookup: damage + hp_change land on the
        // ally, the Boss stays unharmed, lastAttack carries redirected +
        // retarget_original/retarget_to fields. No armed redirect (or an
        // unrelated roll) returns null — byte-inert legacy path.
        await consumePendingRedirectOnResolve(campaignName, context, combatSummary);
        const target = findTargetByContext(combatSummary, context);
        const targetMaxHp = resolveTargetMaxHp(target);

        let applyResult = null;
        let secondaryResult = null;
        let secondaryFinalDamage = 0;
        let reducedTotal = 0;
        let rayReduction = 0;
        let rayOfEnfeebleRoll = null;
        let weakeningReduction = 0;
        let weakeningBreathRoll = null;
        let resistanceReduction = 0;
        let resistanceRoll = null;

        if (target) {
            ({ applyResult, secondaryResult, secondaryFinalDamage, reducedTotal, rayReduction, rayOfEnfeebleRoll, weakeningReduction, weakeningBreathRoll, resistanceReduction, resistanceRoll } = await applyDamageForTarget({
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

        const logEntryData = buildPlainDamageLogData({ characterName, name, modifier, formula, rolls, displayRolls, gwfBaseRolls, gwfDisplayRolls, target, damageType, adjustedTotal, appliedDamage, reducedTotal, isCrit, rayReduction, rayOfEnfeebleRoll, weakeningReduction, weakeningBreathRoll, resistanceReduction, resistanceRoll });
        assignSecondaryFields(logEntryData, secondaryResult, SECONDARY_LOG_SUFFIXES);
        logEntry(logEntryData);

        const damageBreakdown = buildDamageBreakdown(applyResult, secondaryResult, damageType, appliedDamage, reducedTotal);

        writePlainHpResults({ campaignName, target, totalDamageDealt, hpAfterDamage, maxHp, isUnconscious, threshold, damageBreakdown, newHp, oldHp });

        applyResult = await resolveDeathStrike({ applyResult, context, combatSummary, target, characters, campaignName, characterName, adjustedTotal, formula, rolls, modifier, damageType, setPopupHtml, logEntry });

        maybeApplyRamProne({ context, target, applyResult, campaignName, logEntry });
        maybeApplyHitClause({ context, target, applyResult, campaignName, logEntry, characterName });

        handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);

        const popupData = buildPlainPopupData({ name, formula, rolls, modifier, context, target, damageType, adjustedTotal, total, isCrit, gwfBaseRolls, gwfDisplayRolls, rayReduction, rayOfEnfeebleRoll, weakeningReduction, weakeningBreathRoll, resistanceReduction, resistanceRoll });

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
