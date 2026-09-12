import { rollExpression, rollExpressionDoubled, formatDamageFormula } from '../../../services/dice/diceRoller.js';
import { addEntry } from '../../../services/ui/logService.js';
import utils from '../../../services/ui/utils.js';
import {
    computeDamageAfterSave,
    computeDamageAfterEvasion,
    rollSaveForCreature,
    applyDamageToTarget,
    normalizeSaveType,
} from '../../../services/rules/combat/applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance, playerIsImmuneToCondition, evaluateAutoExpression } from '../../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { hasPotentCantrip, hasSoulstitchProtection, clearSoulstitchStamp } from '../loggedDiceRollUtils.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { resolveCreatureType } from '../../../services/combat/creatureTypeResolver.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { hasBuffEffect } from '../../../services/automation/common/buffToggle.js';
import { handleOverchannelSelfDamage } from './handleOverchannelSelfDamage.js';
import { triggerViciousMockeryForGeneric } from '../../../services/rules/features/viciousMockeryService.js';
import { getHpThreshold, assignSecondaryFields, buildDamageBreakdownEntry, computeGwfAdjustedSecondaryTotal, findTargetByContext, resolveTargetMaxHp } from './damageHandlerUtils.js';

const SECONDARY_LOG_SUFFIXES = ['Name', 'Formula', 'Rolls', 'Total', 'Modifier', 'DamageType', 'FinalDamage', 'SaveResult', 'SaveRoll', 'SaveBonus', 'SaveRawRolls', 'DcSuccess'];
const SECONDARY_POPUP_SUFFIXES = ['Name', 'Formula', 'Rolls', 'Total', 'Modifier', 'DamageType', 'FinalDamage'];

// CLA-279: consume Radiant Soul once-per-turn when the save-damage roll carries the
// execution-owned " + N [Radiant Soul]" adder (single-target save spells).
function consumeRadiantSoulOncePerTurn(characterName, formula, appliedDamage, campaignName) {
    if (appliedDamage > 0 && String(formula || '').includes('[Radiant Soul]')) {
        const radiantSoulFlagKey = `_radiantSoul_${characterName.replace(/\s+/g, '_')}_oncePerTurn`;
        setRuntimeValue(characterName, radiantSoulFlagKey, true, campaignName);
    }
}

function applyPostSaveDamageEffects(primaryApplyResult, characterName, campaignName, formula) {
    if (primaryApplyResult && primaryApplyResult.finalDamage > 0) {
        endInvisibilityOnHostileAction(characterName, campaignName);
        consumeRadiantSoulOncePerTurn(characterName, formula, primaryApplyResult.finalDamage, campaignName);
    }
}

// CLA-324: against_spell advantage only on saves against spells — spell-origin is
// identifiable from cast-spell context (school/cantrip/flag) or lastAttack stamps.
function hasSpellOrigin(saveModifiers, context, campaignName) {
    if (!saveModifiers.some(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition === 'against_spell')) return false;
    if (context?.isSpellDamage === true || context?.isCantrip === true || !!context?.autoDamageSchool) return true;
    const lastAttackOrigin = getRuntimeValue('campaign', 'lastAttack', campaignName) || {};
    return lastAttackOrigin.rollType === 'spell-save' || lastAttackOrigin.isSpellDamage === true;
}

// CLA-377: Vicious Mockery disadvantage is applied on the FAILED save only, after the
// save resolves (mirrors the statusEffects-on-fail leg in handleNpcSaveDamage).
async function triggerViciousMockeryOnFailedSave(saveResult, context, target, campaignName, saveDc) {
    if (saveResult.success || !context?.viciousMockerySpell) return;
    try {
        await triggerViciousMockeryForGeneric(
            context.viciousMockerySpell,
            { spellSaveDc: saveDc, targetName: target.name },
            context.playerStats,
            campaignName,
            context.viciousMockeryMapName ?? null
        );
    } catch (e) {
        console.error('[handleNpcSaveDamage] Vicious Mockery trigger failed:', e);
    }
}

// Consume (when present) a 'disadvantage_on_next_save' targetEffect stamp for
// the given target, returning whether one was found.
function consumeDisadvantageStamp(targetName, campaignName) {
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const idx = targetEffects.findIndex(te => te.target === targetName && te.effect === 'disadvantage_on_next_save');
    if (idx === -1) return false;
    targetEffects.splice(idx, 1);
    setRuntimeValue('campaign', 'targetEffects', [...targetEffects], campaignName);
    return true;
}

function resolveSaveModifiers(characters, targetName) {
    const character = (characters || []).find(c => utils.getName(c.name) === targetName);
    return character?.saveModifiers || character?.computedStats?.saveModifiers || [];
}

// Resolve save disadvantage: forced (heightened) → consumed targetEffect stamp →
// corona aura → elder champion aura. Short-circuits on the first hit, exactly
// mirroring the original sequential checks.
async function resolveSaveDisadvantage({ targetName, campaignName, damageType, attackerName, attackerStats, forceDisadvantage, consumeTargetEffect }) {
    if (forceDisadvantage) return true;
    if (consumeTargetEffect && consumeDisadvantageStamp(targetName, campaignName)) {
        return true;
    }
    const coronaResult = getCoronaSaveDisadvantage({ targetName, campaignName, damageType, skipRangeCheck: true });
    if (coronaResult.disadvantage) return true;
    const elderChampionResult = await getElderChampionSaveDisadvantage({ attackerName, attackerStats, targetName });
    return !!elderChampionResult.disadvantage;
}

function computeEvasionFlags({ target, targetCharacter, characters, targetConditions, normalizedSaveType, dcSuccess, campaignName }) {
    const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
    const ownEvasion = targetCharacter?.computedStats?.evasionEffects;
    const hasOwnEvasion = !isIncapacitated && dcSuccess === 'half' && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
    const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && dcSuccess === 'half' &&
        (characters || []).some(c => {
            if (c.name === target.name) return false;
            const ev = c?.computedStats?.evasionEffects;
            return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
        });
    const hasEvasion = hasOwnEvasion || hasSharedEvasion || isCircleOfPowerActive(target.name, campaignName);
    return { hasOwnEvasion, hasEvasion };
}

function grantTempHpToAllies(tempHp, combatSummary, campaignName, characterName) {
    if (!(tempHp && !isNaN(tempHp) && tempHp > 0)) return;
    const allies = combatSummary?.creatures?.filter(c =>
        c.type === 'player' || c.type === 'npc' || c.type === 'monster'
    ) || [];
    if (allies.length === 0) return;
    const targets = allies.map(c => ({
        name: c.name,
        currentHp: c.currentHp,
        maxHp: c.maxHp,
        size: c.size,
        type: c.type,
    }));
    window.dispatchEvent(new CustomEvent('potent-spellcasting-temp-hp', {
        detail: {
            title: 'Improved Blessed Strikes — Potent Spellcasting',
            targets,
            tempHp,
            campaignName,
            attackerName: characterName,
            confirmLabel: 'Grant Temp HP',
        },
        bubbles: true,
    }));
}

function maybeGrantBlessedStrikesTempHp(context, combatSummary, campaignName, characterName) {
    const playerStats = context?.playerStats;
    if (!playerStats?.automation?.actions) return;
    const allAutomation = [
        ...(playerStats.automation.actions || []),
        ...(playerStats.automation.passives || []),
    ];
    const cantripBonuses = playerStats.automation.actions.filter(
        a => a.type === 'damage_bonus' && a.options?.length > 0 && a.tempHpExpression
    );
    const upgradedNames = new Set(allAutomation.filter(b => b.upgrades).map(b => b.upgrades));
    const filteredBonuses = cantripBonuses.filter(b => !upgradedNames.has(b.name));
    for (const bonus of filteredBonuses) {
        grantTempHpToAllies(evaluateAutoExpression(bonus.tempHpExpression, playerStats), combatSummary, campaignName, characterName);
    }
}

async function resolveSecondarySaveResult({ target, context, saveResult, advantage, campaignName, characterName, secondaryDamageType }) {
    if (!context.saveDc || !context.saveType) return saveResult;
    const secondaryDisadvantage = await resolveSaveDisadvantage({
        targetName: target.name,
        campaignName,
        damageType: secondaryDamageType,
        attackerName: characterName,
        attackerStats: context?.playerStats,
        forceDisadvantage: context.metamagicHeighten || false,
        consumeTargetEffect: false,
    });
    return rollSaveForCreature(target, context.saveType, context.saveDc, secondaryDisadvantage, advantage);
}

function computeSecondaryRawDamage(secondaryTotal, secondarySaveResult, { isSoulstitchProtected, hasPotentFlag, isCantripFlag, dcSuccess }) {
    if (isSoulstitchProtected) return 0;
    if (hasPotentFlag && isCantripFlag && secondarySaveResult.success && dcSuccess === 'none') {
        return Math.floor(secondaryTotal / 2);
    }
    return computeDamageAfterSave(secondaryTotal, secondarySaveResult.success, dcSuccess);
}

function buildSecondaryResult({ secondaryName, secondaryFormula, secondaryRollResult, secondaryTotal, secondaryDamageType, secondaryFinalDamage, secondaryApplyResult, secondarySaveResult, isSoulstitchProtected, dcSuccess }) {
    return {
        name: secondaryName,
        formula: secondaryFormula,
        rolls: secondaryRollResult.rolls,
        total: secondaryTotal,
        modifier: secondaryRollResult.modifier,
        damageType: secondaryDamageType,
        finalDamage: secondaryFinalDamage,
        resistanceDetails: secondaryApplyResult?.resistanceDetails || [],
        saveResult: isSoulstitchProtected ? 'soulstitch_auto_success' : (secondarySaveResult.success ? 'success' : 'failure'),
        saveRoll: secondarySaveResult.roll,
        saveBonus: secondarySaveResult.bonus,
        saveRawRolls: secondarySaveResult.rawRolls,
        dcSuccess,
    };
}

async function rollAndApplySecondarySaveDamage({ context, combatSummary, target, saveResult, advantage, isSoulstitchProtected, hasPotentFlag, isCantripFlag, characters, campaignName, characterName, name }) {
    if (!context?.autoDamageSecondaryFormula) return { secondaryResult: null, secondaryFinalDamage: 0 };
    const secondaryFormula = context.autoDamageSecondaryFormula;
    const secondaryName = context.autoDamageSecondaryName || name;
    const secondaryDamageType = context.autoDamageSecondaryDamageType;
    const secondaryRollResult = context?.isAutoCrit ? rollExpressionDoubled(secondaryFormula) : rollExpression(secondaryFormula);
    if (!secondaryRollResult) return { secondaryResult: null, secondaryFinalDamage: 0 };

    const secondaryTotal = computeGwfAdjustedSecondaryTotal(secondaryRollResult, context?.playerStats, secondaryDamageType);
    const secondarySaveResult = await resolveSecondarySaveResult({ target, context, saveResult, advantage, campaignName, characterName, secondaryDamageType });
    const secondaryRawDamage = computeSecondaryRawDamage(secondaryTotal, secondarySaveResult, { isSoulstitchProtected, hasPotentFlag, isCantripFlag, dcSuccess: context.dcSuccess });
    const secondaryIgnoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, secondaryDamageType)) || false;
    const secondaryApplyResult = await applyDamageToTarget(combatSummary, target.name, secondaryRawDamage, [secondaryDamageType], campaignName, characters, { ignoreResistance: secondaryIgnoreResistance, attackerName: characterName, suppressHpLog: true, ...{ skipConcentration: true } });
    const secondaryFinalDamage = secondaryApplyResult?.finalDamage ?? secondaryRawDamage;
    if (secondaryApplyResult && secondaryApplyResult.finalDamage > 0) {
        endInvisibilityOnHostileAction(characterName, campaignName);
    }
    const secondaryResult = buildSecondaryResult({ secondaryName, secondaryFormula, secondaryRollResult, secondaryTotal, secondaryDamageType, secondaryFinalDamage, secondaryApplyResult, secondarySaveResult, isSoulstitchProtected, dcSuccess: context.dcSuccess });
    return { secondaryResult, secondaryFinalDamage };
}

function applyFailedSaveConditions(context, target, targetCharacter, combatSummary, characterName, campaignName) {
    for (const effect of context.statusEffects) {
        const condKey = String(effect).toLowerCase();
        const targetStats = targetCharacter?.computedStats || targetCharacter;
        const attackerCreature = combatSummary?.creatures?.find(c => c.name === characterName);
        if (targetStats && playerIsImmuneToCondition({
            conditionKey: condKey,
            playerStats: targetStats,
            getRuntimeValue: getRuntimeValue,
            campaignName: campaignName,
            sourceCreatureType: resolveCreatureType(attackerCreature),
        })) {
            continue;
        }
        const conditions = getRuntimeValue(target.name, 'activeConditions') || [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
        setRuntimeValue(target.name, 'activeConditions', [...filtered, condKey], campaignName);
    }
}

function buildTwinSaveLogData({ characterName, name, modifier, displayFormula, displayRolls, adjustedTotal, damageType, twinTarget, saveType, saveDc, twinSaveResult, twinDisadvantage, isCrit, gwfBaseRolls, gwfDisplayRolls }) {
    return {
        type: 'roll',
        characterName,
        rollType: 'save-damage',
        name: `${name} (Twinned)`,
        formula: displayFormula,
        rolls: displayRolls,
        total: adjustedTotal,
        modifier,
        damageType,
        targetName: twinTarget.name,
        saveType,
        saveDc,
        saveResult: twinSaveResult.success ? 'success' : 'failure',
        saveRoll: twinSaveResult.roll,
        saveBonus: twinSaveResult.bonus,
        saveRawRolls: twinSaveResult.rawRolls,
        forcedMode: twinDisadvantage ? 'disadvantage' : 'normal',
        finalDamage: null,
        note: 'twin_save_damage_roll_before_apply',
        isCrit,
        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
        gwfDisplayRolls: displayRolls,
    };
}

async function handleTwinSaveTarget({ name, modifier, context, combatSummary, target, campaignName, characterName, characters, saveType, saveDc, dcSuccess, damageType, adjustedTotal, formula, displayRolls, gwfBaseRolls, gwfDisplayRolls, hasPotentFlag, isCantripFlag, setPopupHtml, logEntry }) {
    const twinTarget = combatSummary?.creatures?.find(c => c.name === context.metamagicTwinTarget);
    if (!twinTarget || twinTarget.name === target.name) return;

    const twinDisadvantage = await resolveSaveDisadvantage({
        targetName: twinTarget.name,
        campaignName,
        damageType,
        attackerName: characterName,
        attackerStats: context?.playerStats,
        forceDisadvantage: context?.metamagicHeighten || false,
        consumeTargetEffect: true,
    });
    const twinAdvantage = hasSpellOrigin(resolveSaveModifiers(characters, twinTarget.name), context, campaignName);
    const twinSaveResult = rollSaveForCreature(twinTarget, saveType, saveDc, twinDisadvantage, twinAdvantage);
    const twinFinalDamage = applyPotentCantripHalfDamage(computeDamageAfterSave(adjustedTotal, twinSaveResult.success, dcSuccess), { isSoulstitchProtected: false, hasPotentFlag, isCantripFlag, saveSuccess: twinSaveResult.success, dcSuccess, adjustedTotal });
    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

    const isCrit = context?.isAutoCrit || false;
    const displayFormula = isCrit ? formatDamageFormula(formula, displayRolls, true) : formula;

    logEntry(buildTwinSaveLogData({ characterName, name, modifier, displayFormula, displayRolls, adjustedTotal, damageType, twinTarget, saveType, saveDc, twinSaveResult, twinDisadvantage, isCrit, gwfBaseRolls, gwfDisplayRolls }));

    const twinApplyResult = await applyDamageToTarget(combatSummary, twinTarget.name, twinFinalDamage, [damageType], campaignName, characters, { ignoreResistance: ignoreResistance, attackerName: characterName });

    if (twinApplyResult && twinApplyResult.finalDamage > 0) {
        endInvisibilityOnHostileAction(characterName, campaignName);
    }
    setPopupHtml(prev => ({ ...prev, ...buildSecondTargetPopupPatch(twinTarget, twinApplyResult) }));
}

// Second-target popup patch shared by the twinned and multi-target save legs.
function buildSecondTargetPopupPatch(secondTarget, applyResult) {
    return {
        twinTargetName: secondTarget.name,
        twinFinalDamage: applyResult?.finalDamage,
        twinTargetCurrentHp: applyResult?.newHp,
        twinTargetMaxHp: secondTarget.type === 'npc'
            ? secondTarget.maxHp
            : (getRuntimeValue(secondTarget.name, 'hitPoints') ?? 0),
    };
}

async function applyMultiTargetPlainDamage({ name, modifier, context, combatSummary, multiTarget, campaignName, characterName, damageType, total, formula, rolls, setPopupHtml, logEntry }) {
    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

    const isCrit = context?.isAutoCrit || false;
    const displayFormula = isCrit ? formatDamageFormula(formula, rolls, true) : formula;
    logEntry({
        type: 'roll',
        characterName,
        rollType: 'save-damage',
        name: `${name} (Words of Creation)`,
        formula: displayFormula,
        rolls,
        total,
        modifier,
        damageType,
        targetName: multiTarget.name,
        finalDamage: null,
        note: 'multi_plain_damage_roll_before_apply',
        isCrit,
    });

    const multiApplyResult = await applyDamageToTarget(combatSummary, multiTarget.name, total, [damageType], campaignName, null, { ignoreResistance: ignoreResistance, attackerName: characterName });

    if (multiApplyResult && multiApplyResult.finalDamage > 0) {
        endInvisibilityOnHostileAction(characterName, campaignName);
    }

    setPopupHtml(prev => ({ ...prev, ...buildSecondTargetPopupPatch(multiTarget, multiApplyResult) }));
}

function buildMultiSaveLogData({ characterName, name, modifier, context, multiTarget, saveType, saveDc, multiSaveResult, damageType, adjustedTotal, displayRolls, formula, gwfBaseRolls, gwfDisplayRolls }) {
    const isCrit = context?.isAutoCrit || false;
    return {
        type: 'roll',
        characterName,
        rollType: 'save-damage',
        name: `${name} (Words of Creation)`,
        formula: isCrit ? formatDamageFormula(formula, displayRolls, true) : formula,
        rolls: displayRolls,
        total: adjustedTotal,
        modifier,
        damageType,
        targetName: multiTarget.name,
        saveType,
        saveDc,
        saveResult: multiSaveResult.success ? 'success' : 'failure',
        saveRoll: multiSaveResult.roll,
        saveBonus: multiSaveResult.bonus,
        saveRawRolls: multiSaveResult.rawRolls,
        mode: 'normal',
        finalDamage: null,
        note: 'multi_save_damage_roll_before_apply',
        isCrit,
        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
    };
}

async function handleMultiSaveTarget({ name, modifier, context, combatSummary, target, characters, campaignName, characterName, saveType, saveDc, dcSuccess, damageType, adjustedTotal, total, formula, rolls, displayRolls, gwfBaseRolls, gwfDisplayRolls, hasPotentFlag, isCantripFlag, setPopupHtml, logEntry }) {
    const multiTarget = combatSummary?.creatures?.find(c => c.name === context.multiTarget);
    if (!multiTarget || multiTarget.name === target.name) return;

    if (!saveType || !saveDc) {
        await applyMultiTargetPlainDamage({ name, modifier, context, combatSummary, multiTarget, campaignName, characterName, damageType, total, formula, rolls, setPopupHtml, logEntry });
        return;
    }

    const multiAdvantage = hasSpellOrigin(resolveSaveModifiers(characters, multiTarget.name), context, campaignName);
    const multiDisadvantage = consumeDisadvantageStamp(multiTarget.name, campaignName);
    const multiSaveResult = rollSaveForCreature(multiTarget, saveType, saveDc, multiDisadvantage, multiAdvantage);
    const multiFinalDamage = applyPotentCantripHalfDamage(computeDamageAfterSave(adjustedTotal, multiSaveResult.success, dcSuccess), { isSoulstitchProtected: false, hasPotentFlag, isCantripFlag, saveSuccess: multiSaveResult.success, dcSuccess, adjustedTotal });
    logEntry(buildMultiSaveLogData({ characterName, name, modifier, context, multiTarget, saveType, saveDc, multiSaveResult, damageType, adjustedTotal, displayRolls, formula, gwfBaseRolls, gwfDisplayRolls }));

    const multiApplyResult = await applyDamageToTarget(combatSummary, multiTarget.name, multiFinalDamage, [damageType], campaignName, null);

    setPopupHtml(prev => ({ ...prev, ...buildSecondTargetPopupPatch(multiTarget, multiApplyResult) }));
}

function maybeGrantBlessedStrikesOnFailedSave(context, { isSoulstitchProtected, isCantripFlag, saveSuccess, dcSuccess, combatSummary, campaignName, characterName }) {
    if (isSoulstitchProtected || !isCantripFlag || saveSuccess || dcSuccess !== 'none') return;
    const hasBlessedStrikesOptions = context?.playerStats?.automation?.actions?.some(
        a => a.type === 'damage_bonus' && a.options?.length > 0 && a.options.includes('Potent Spellcasting')
    ) || false;
    if (!hasBlessedStrikesOptions) return;
    maybeGrantBlessedStrikesTempHp(context, combatSummary, campaignName, characterName);
}

function applyPotentCantripHalfDamage(finalDamage, { isSoulstitchProtected, hasPotentFlag, isCantripFlag, saveSuccess, dcSuccess, adjustedTotal }) {
    if (!isSoulstitchProtected && hasPotentFlag && isCantripFlag && saveSuccess && dcSuccess === 'none') {
        return Math.floor(adjustedTotal / 2);
    }
    return finalDamage;
}

function buildSaveLogData({ characterName, name, modifier, formula, target, saveResult, saveDc, saveType, damageType, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls, isCrit, disadvantage, isSoulstitchProtected, primaryFinalDamage }) {
    return {
        type: 'roll',
        characterName,
        rollType: 'save-damage',
        name,
        formula: isCrit ? formatDamageFormula(formula, displayRolls, true) : formula,
        rolls: displayRolls,
        total: adjustedTotal,
        modifier,
        damageType,
        targetName: target.name,
        saveType,
        saveDc,
        saveResult: isSoulstitchProtected ? 'soulstitch_auto_success' : (saveResult.success ? 'success' : 'failure'),
        saveRoll: saveResult.roll,
        saveBonus: saveResult.bonus,
        saveRawRolls: saveResult.rawRolls,
        forcedMode: disadvantage ? 'disadvantage' : 'normal',
        finalDamage: primaryFinalDamage,
        note: 'combined_save_damage_roll',
        isCrit,
        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
        gwfDisplayRolls: gwfDisplayRolls,
    };
}

function writeDamageResults({ campaignName, target, totalDamageDealt, newHp, oldHp, isDead, maxHp, threshold, damageBreakdown }) {
    if (totalDamageDealt > 0) {
        const hpEntry = {
            type: 'hp_change',
            targetName: target.name,
            delta: -(totalDamageDealt),
            currentHp: newHp,
            maxHp,
            isHealing: false,
            isUnconscious: isDead,
            damageBreakdown,
        };
        if (threshold) hpEntry.threshold = threshold;
        addEntry(campaignName, hpEntry).catch((e) => { console.error("[useLoggedDiceRollDamage] Error:", e); });
    }

    if (target.type === 'player') {
        setRuntimeValue(target.name, 'currentHitPoints', newHp, campaignName);
        if (oldHp > 0 && isDead) {
            setRuntimeValue(target.name, 'deathSaves', [false, false, false], campaignName);
            setRuntimeValue(target.name, 'deathFailures', [false, false, false], campaignName);
        }
    }
}

function buildSavePopupData({ name, formula, rolls, modifier, target, saveResult, saveDc, saveType, dcSuccess, damageType, adjustedTotal, newHp, targetMaxHp, disadvantage, advantage, isCrit, gwfBaseRolls, gwfDisplayRolls, isSoulstitchProtected, primaryFinalDamage, primaryApplyResult }) {
    return {
        type: 'save-damage',
        name,
        formula,
        rolls,
        total: adjustedTotal,
        bonus: 0,
        modifier,
        damageType,
        targetName: target.name,
        targetCurrentHp: newHp,
        targetMaxHp,
        saveDc,
        saveType,
        dcSuccess,
        // CLA-321: popup displays the same roll the log records (success forced, damage 0).
        saveResult: isSoulstitchProtected ? { success: true, roll: saveResult.roll, total: saveResult.total, bonus: saveResult.bonus } : saveResult,
        finalDamage: primaryFinalDamage,
        damageApplied: primaryFinalDamage > 0,
        damageReduced: primaryApplyResult?.damageReduced,
        isCrit,
        forcedMode: disadvantage ? 'disadvantage' : (advantage ? 'advantage' : 'normal'),
        gwfApplied: gwfDisplayRolls !== gwfBaseRolls,
        gwfOriginalRolls: gwfDisplayRolls !== gwfBaseRolls ? gwfBaseRolls : null,
        gwfDisplayRolls: gwfDisplayRolls,
    };
}

function buildSaveLastAttackEntry({ attackerName, statusEffects, affectedTargets, target, saveResult, saveType, saveDc, formula, name, damageType, adjustedTotal, isSoulstitchProtected, primaryFinalDamage }) {
    const saveOutcome = isSoulstitchProtected ? 'success' : (saveResult.success ? 'success' : 'failure');
    return {
        attackerName: attackerName || null,
        targetName: target.name,
        d20: saveResult.roll,
        d20Rolls: saveResult.rawRolls || [saveResult.roll],
        bonus: saveResult.bonus,
        total: saveResult.total,
        rollType: 'attack',
        saveType: saveType || null,
        saveDc: saveDc,
        saveResult: saveOutcome,
        damageFormula: formula || null,
        damageName: name || null,
        damageType: damageType || null,
        rawDamage: adjustedTotal || 0,
        primaryDamage: adjustedTotal || 0,
        primaryDamageType: damageType || null,
        actualDamage: primaryFinalDamage,
        damageApplied: primaryFinalDamage > 0,
        statusEffects: statusEffects || null,
        affectedTargets: affectedTargets || [target.name],
        timestamp: Date.now(),
    };
}

function storeSaveLastAttack({ context, campaignName, target, saveResult, saveType, saveDc, formula, name, damageType, adjustedTotal, isSoulstitchProtected, primaryFinalDamage, characterName }) {
    const { attackerName, statusEffects, affectedTargets } = context || {};
    if (!attackerName || !target?.name) {
        console.error('[useLoggedDiceRollDamage] lastAttack missing required fields:', { attackerName, targetName: target?.name, characterName });
    }
    const entry = buildSaveLastAttackEntry({ attackerName, statusEffects, affectedTargets, target, saveResult, saveType, saveDc, formula, name, damageType, adjustedTotal, isSoulstitchProtected, primaryFinalDamage });
    setRuntimeValue('campaign', 'lastAttack', entry, campaignName);
}

// CLA-394: Zealous Presence buff (advantage_attacks_and_saves) grants blanket save advantage.
function resolveSaveAdvantage(target, targetSaveModifiers, context, campaignName) {
    return hasSpellOrigin(targetSaveModifiers, context, campaignName) || isCircleOfPowerActive(target.name, campaignName) || hasBuffEffect(target.name, 'advantage_attacks_and_saves', campaignName);
}

function logEvasionRoll({ target, hasOwnEvasion, saveResult, saveType, saveDc, dcSuccess, logEntry }) {
    logEntry({
        type: 'roll',
        characterName: target.name,
        rollType: 'evasion',
        name: hasOwnEvasion ? 'Evasion' : 'Leading Evasion',
        targetName: target.name,
        saveType,
        saveDc,
        saveResult: saveResult.success ? 'success' : 'failure',
        dcSuccess,
        timestamp: Date.now(),
        id: utils.guid(),
    });
}

function writeNpcDamageOutcome({ target, primaryApplyResult, secondaryResult, secondaryFinalDamage, damageType, primaryFinalDamage, campaignName }) {
    const totalDamageDealt = (primaryApplyResult?.finalDamage ?? 0) + secondaryFinalDamage;
    const newHp = primaryApplyResult?.newHp ?? target.currentHp;
    const oldHp = newHp + totalDamageDealt;
    const isDead = newHp <= 0;
    const maxHp = target.type === 'player'
        ? (getRuntimeValue(target.name, 'hitPoints') ?? newHp)
        : target.maxHp;
    const threshold = getHpThreshold({ oldHp, newHp, maxHp });

    const damageBreakdown = [buildDamageBreakdownEntry(primaryApplyResult, damageType, primaryFinalDamage)];
    if (secondaryResult) {
        damageBreakdown.push(buildDamageBreakdownEntry(secondaryResult, secondaryResult.damageType, secondaryResult.finalDamage));
    }

    writeDamageResults({ campaignName, target, totalDamageDealt, newHp, oldHp, isDead, maxHp, threshold, damageBreakdown });
    return { newHp };
}

// Roll the target's save and derive evasion/potent-cantrip damage, in the
// original read/log order (evasion log fires mid-block, before damage adjust).
function rollTargetSaveDamage({ context, target, characters, combatSummary, campaignName, characterName, disadvantage, saveType, saveDc, dcSuccess, adjustedTotal, logEntry }) {
    const isSoulstitchProtected = hasSoulstitchProtection(target.name, characterName, campaignName);
    const targetCharacter = (characters || []).find(c => utils.getName(c.name) === target.name);
    const advantage = resolveSaveAdvantage(target, resolveSaveModifiers(characters, target.name), context, campaignName);
    const saveResult = rollSaveForCreature(target, saveType, saveDc, disadvantage, advantage);
    const normalizedSaveType = normalizeSaveType(saveType);
    const targetConditions = getRuntimeValue(target.name, 'activeConditions', campaignName) || [];
    const { hasOwnEvasion, hasEvasion } = computeEvasionFlags({ target, targetCharacter, characters, targetConditions, normalizedSaveType, dcSuccess, campaignName });
    let finalDamage = isSoulstitchProtected ? 0 : computeDamageAfterEvasion(adjustedTotal, saveResult.success, dcSuccess, hasEvasion);

    if (hasEvasion) {
        logEvasionRoll({ target, hasOwnEvasion, saveResult, saveType, saveDc, dcSuccess, logEntry });
    }

    const isCantripFlag = context?.isCantrip || false;
    const hasPotentFlag = hasPotentCantrip(context?.playerStats);
    finalDamage = applyPotentCantripHalfDamage(finalDamage, { isSoulstitchProtected, hasPotentFlag, isCantripFlag, saveSuccess: saveResult.success, dcSuccess, adjustedTotal });
    maybeGrantBlessedStrikesOnFailedSave(context, { isSoulstitchProtected, isCantripFlag, saveSuccess: saveResult.success, dcSuccess, combatSummary, campaignName, characterName });
    return { targetCharacter, saveResult, advantage, finalDamage, isCantripFlag, hasPotentFlag, isSoulstitchProtected };
}

async function runNpcSaveDamageTail({ context, name, modifier, rolls, total, combatSummary, target, characters, campaignName, characterName, saveType, saveDc, dcSuccess, damageType, adjustedTotal, formula, displayRolls, gwfBaseRolls, gwfDisplayRolls, hasPotentFlag, isCantripFlag, setPopupHtml, logEntry }) {
    handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters);

    // CLA-321: Soulstitch protection lasts only for the cast that wrote the stamp.
    if (context?.soulstitchCast) {
        clearSoulstitchStamp(characterName, campaignName);
    }

    if (context?.metamagicTwinTarget) {
        await handleTwinSaveTarget({ context, combatSummary, target, campaignName, characterName, characters, saveType, saveDc, dcSuccess, damageType, adjustedTotal, formula, displayRolls, gwfBaseRolls, gwfDisplayRolls, hasPotentFlag, isCantripFlag, setPopupHtml, logEntry, name, modifier });
    }

    if (context?.multiTarget) {
        await handleMultiSaveTarget({ context, combatSummary, target, campaignName, characterName, characters, saveType, saveDc, dcSuccess, damageType, adjustedTotal, total, formula, rolls, displayRolls, gwfBaseRolls, gwfDisplayRolls, hasPotentFlag, isCantripFlag, setPopupHtml, logEntry, name, modifier });
    }
}

export function createNpcSaveDamageHandler(deps) {
    const { characterName, campaignName, characters, setPopupHtml, logEntry } = deps;

    return async function handleNpcSaveDamage({ name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls }) {
        const { saveDc, saveType, dcSuccess, damageType } = context || {};
        const playerStats = context?.playerStats;
        const target = findTargetByContext(combatSummary, context);
        if (!target) return;
        const targetMaxHp = resolveTargetMaxHp(target);

        const disadvantage = await resolveSaveDisadvantage({
            targetName: target.name,
            campaignName,
            damageType,
            attackerName: characterName,
            attackerStats: playerStats,
            forceDisadvantage: Boolean(context?.metamagicHeighten),
            consumeTargetEffect: true,
        });
        const { targetCharacter, saveResult, advantage, finalDamage, isCantripFlag, hasPotentFlag, isSoulstitchProtected } = rollTargetSaveDamage({
            context, target, characters, combatSummary, campaignName, characterName, disadvantage, saveType, saveDc, dcSuccess, adjustedTotal, logEntry,
        });
        const ignoreResistance = playerStats ? hasIgnoreResistance(playerStats, damageType) : false;

        const { secondaryResult, secondaryFinalDamage } = await rollAndApplySecondarySaveDamage({
            context, combatSummary, target, saveResult, advantage, isSoulstitchProtected, hasPotentFlag, isCantripFlag, characters, campaignName, characterName, name,
        });

        const primaryApplyResult = secondaryFinalDamage > 0
          ? await applyDamageToTarget(combatSummary, target.name, finalDamage, [damageType], campaignName, characters, { ignoreResistance: ignoreResistance, attackerName: characterName, suppressHpLog: true, ...{ concentrationTotalDamage: finalDamage + secondaryFinalDamage } })
          : await applyDamageToTarget(combatSummary, target.name, finalDamage, [damageType], campaignName, characters, { ignoreResistance: ignoreResistance, attackerName: characterName, suppressHpLog: true });

        applyPostSaveDamageEffects(primaryApplyResult, characterName, campaignName, formula);

        const isCrit = Boolean(context?.isAutoCrit);
        const primaryFinalDamage = primaryApplyResult?.finalDamage ?? finalDamage;
        const logEntryData = buildSaveLogData({ characterName, name, modifier, formula, target, saveResult, saveDc, saveType, damageType, adjustedTotal, displayRolls, gwfBaseRolls, gwfDisplayRolls, isCrit, disadvantage, isSoulstitchProtected, primaryFinalDamage });
        assignSecondaryFields(logEntryData, secondaryResult, SECONDARY_LOG_SUFFIXES);
        logEntry(logEntryData);

        const { newHp } = writeNpcDamageOutcome({ target, primaryApplyResult, secondaryResult, secondaryFinalDamage, damageType, primaryFinalDamage, campaignName });

        if (!saveResult.success && context?.statusEffects?.length > 0) {
            applyFailedSaveConditions(context, target, targetCharacter, combatSummary, characterName, campaignName);
        }

        await triggerViciousMockeryOnFailedSave(saveResult, context, target, campaignName, saveDc);

        const popupData = buildSavePopupData({ name, formula, rolls, modifier, target, saveResult, saveDc, saveType, dcSuccess, damageType, adjustedTotal, newHp, targetMaxHp, disadvantage, advantage, isCrit, gwfBaseRolls, gwfDisplayRolls, isSoulstitchProtected, primaryFinalDamage, primaryApplyResult });
        assignSecondaryFields(popupData, secondaryResult, SECONDARY_POPUP_SUFFIXES);

        storeSaveLastAttack({ context, campaignName, target, saveResult, saveType, saveDc, formula, name, damageType, adjustedTotal, isSoulstitchProtected, primaryFinalDamage, characterName });

        setPopupHtml(popupData);

        await runNpcSaveDamageTail({ context, name, modifier, rolls, total, combatSummary, target, characters, campaignName, characterName, saveType, saveDc, dcSuccess, damageType, adjustedTotal, formula, displayRolls, gwfBaseRolls, gwfDisplayRolls, hasPotentFlag, isCantripFlag, setPopupHtml, logEntry });
    };
}
