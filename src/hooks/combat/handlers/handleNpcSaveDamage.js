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
import { getHpThreshold, assignSecondaryFields, buildDamageBreakdownEntry, computeGwfAdjustedSecondaryTotal } from './damageHandlerUtils.js';

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

// Resolve save disadvantage: forced (heightened) → consumed targetEffect stamp →
// corona aura → elder champion aura. Short-circuits on the first hit, exactly
// mirroring the original sequential checks.
async function resolveSaveDisadvantage({ targetName, campaignName, damageType, attackerName, attackerStats, forceDisadvantage, consumeTargetEffect }) {
    if (forceDisadvantage) return true;
    if (consumeTargetEffect) {
        const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
        const idx = targetEffects.findIndex(te => te.target === targetName && te.effect === 'disadvantage_on_next_save');
        if (idx !== -1) {
            targetEffects.splice(idx, 1);
            setRuntimeValue('campaign', 'targetEffects', [...targetEffects], campaignName);
            return true;
        }
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

async function rollAndApplySecondarySaveDamage({ context, combatSummary, target, saveResult, advantage, isSoulstitchProtected, hasPotentFlag, isCantripFlag, characters, campaignName, characterName, name }) {
    if (!context?.autoDamageSecondaryFormula) return { secondaryResult: null, secondaryFinalDamage: 0 };
    const secondaryFormula = context.autoDamageSecondaryFormula;
    const secondaryName = context.autoDamageSecondaryName || name;
    const secondaryDamageType = context.autoDamageSecondaryDamageType;
    const secondaryRollResult = context?.isAutoCrit ? rollExpressionDoubled(secondaryFormula) : rollExpression(secondaryFormula);
    if (!secondaryRollResult) return { secondaryResult: null, secondaryFinalDamage: 0 };

    const secondaryTotal = computeGwfAdjustedSecondaryTotal(secondaryRollResult, context?.playerStats, secondaryDamageType);
    let secondarySaveResult = saveResult;
    if (context.saveDc && context.saveType) {
        const secondaryDisadvantage = await resolveSaveDisadvantage({
            targetName: target.name,
            campaignName,
            damageType: secondaryDamageType,
            attackerName: characterName,
            attackerStats: context?.playerStats,
            forceDisadvantage: context.metamagicHeighten || false,
            consumeTargetEffect: false,
        });
        secondarySaveResult = rollSaveForCreature(target, context.saveType, context.saveDc, secondaryDisadvantage, advantage);
    }
    let secondaryRawDamage = isSoulstitchProtected ? 0 : computeDamageAfterSave(secondaryTotal, secondarySaveResult.success, context.dcSuccess);
    if (!isSoulstitchProtected && hasPotentFlag && isCantripFlag && secondarySaveResult.success && context.dcSuccess === 'none') {
        secondaryRawDamage = Math.floor(secondaryTotal / 2);
    }
    const secondaryIgnoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, secondaryDamageType)) || false;
    const secondaryApplyResult = await applyDamageToTarget(combatSummary, target.name, secondaryRawDamage, [secondaryDamageType], campaignName, characters, secondaryIgnoreResistance, characterName, true, { skipConcentration: true });
    const secondaryFinalDamage = secondaryApplyResult?.finalDamage ?? secondaryRawDamage;
    if (secondaryApplyResult && secondaryApplyResult.finalDamage > 0) {
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
        resistanceDetails: secondaryApplyResult?.resistanceDetails || [],
        saveResult: isSoulstitchProtected ? 'soulstitch_auto_success' : (secondarySaveResult.success ? 'success' : 'failure'),
        saveRoll: secondarySaveResult.roll,
        saveBonus: secondarySaveResult.bonus,
        saveRawRolls: secondarySaveResult.rawRolls,
        dcSuccess: context.dcSuccess,
    };
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
    const twinCharacter = (characters || []).find(c => utils.getName(c.name) === twinTarget.name);
    const twinSaveModifiers = twinCharacter?.saveModifiers || twinCharacter?.computedStats?.saveModifiers || [];
    const twinAdvantage = hasSpellOrigin(twinSaveModifiers, context, campaignName);
    const twinSaveResult = rollSaveForCreature(twinTarget, saveType, saveDc, twinDisadvantage, twinAdvantage);
    let twinFinalDamage = computeDamageAfterSave(adjustedTotal, twinSaveResult.success, dcSuccess);
    if (hasPotentFlag && isCantripFlag && twinSaveResult.success && dcSuccess === 'none') {
        twinFinalDamage = Math.floor(adjustedTotal / 2);
    }
    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

    const isCrit = context?.isAutoCrit || false;
    const displayFormula = isCrit ? formatDamageFormula(formula, displayRolls, true) : formula;

    logEntry({
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
    });

    const twinApplyResult = await applyDamageToTarget(combatSummary, twinTarget.name, twinFinalDamage, [damageType], campaignName, characters, ignoreResistance, characterName);

    if (twinApplyResult && twinApplyResult.finalDamage > 0) {
        endInvisibilityOnHostileAction(characterName, campaignName);
    }
    setPopupHtml(prev => ({
        ...prev,
        twinTargetName: twinTarget.name,
        twinFinalDamage: twinApplyResult?.finalDamage,
        twinTargetCurrentHp: twinApplyResult?.newHp,
        twinTargetMaxHp: twinTarget.type === 'npc'
            ? twinTarget.maxHp
            : (getRuntimeValue(twinTarget.name, 'hitPoints') ?? 0),
    }));
}

async function handleMultiSaveTarget({ name, modifier, context, combatSummary, target, characters, campaignName, characterName, saveType, saveDc, dcSuccess, damageType, adjustedTotal, total, formula, rolls, displayRolls, gwfBaseRolls, gwfDisplayRolls, hasPotentFlag, isCantripFlag, setPopupHtml, logEntry }) {
    const multiTarget = combatSummary?.creatures?.find(c => c.name === context.multiTarget);
    if (!multiTarget || multiTarget.name === target.name) return;

    if (!saveType || !saveDc) {
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

        const multiApplyResult = await applyDamageToTarget(combatSummary, multiTarget.name, total, [damageType], campaignName, null, ignoreResistance, characterName);

        if (multiApplyResult && multiApplyResult.finalDamage > 0) {
            endInvisibilityOnHostileAction(characterName, campaignName);
        }

        setPopupHtml(prev => ({
            ...prev,
            twinTargetName: multiTarget.name,
            twinFinalDamage: multiApplyResult?.finalDamage,
            twinTargetCurrentHp: multiApplyResult?.newHp,
            twinTargetMaxHp: multiTarget.type === 'npc'
                ? multiTarget.maxHp
                : (getRuntimeValue(multiTarget.name, 'hitPoints') ?? 0),
        }));
        return;
    }

    const multiCharacter = (characters || []).find(c => utils.getName(c.name) === multiTarget.name);
    const multiSaveModifiers = multiCharacter?.saveModifiers || multiCharacter?.computedStats?.saveModifiers || [];
    const multiAdvantage = hasSpellOrigin(multiSaveModifiers, context, campaignName);
    let multiDisadvantage = false;
    const multiTargetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const multiIdx = multiTargetEffects.findIndex(te => te.target === multiTarget.name && te.effect === 'disadvantage_on_next_save');
    if (multiIdx !== -1) {
        multiDisadvantage = true;
        multiTargetEffects.splice(multiIdx, 1);
        setRuntimeValue('campaign', 'targetEffects', [...multiTargetEffects], campaignName);
    }
    const multiSaveResult = rollSaveForCreature(multiTarget, saveType, saveDc, multiDisadvantage, multiAdvantage);
    let multiFinalDamage = computeDamageAfterSave(adjustedTotal, multiSaveResult.success, dcSuccess);
    if (hasPotentFlag && isCantripFlag && multiSaveResult.success && dcSuccess === 'none') {
        multiFinalDamage = Math.floor(adjustedTotal / 2);
    }
    const isCrit = context?.isAutoCrit || false;
    const displayFormula = isCrit ? formatDamageFormula(formula, displayRolls, true) : formula;
    logEntry({
        type: 'roll',
        characterName,
        rollType: 'save-damage',
        name: `${name} (Words of Creation)`,
        formula: displayFormula,
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
    });

    const multiApplyResult = await applyDamageToTarget(combatSummary, multiTarget.name, multiFinalDamage, [damageType], campaignName, null);

    setPopupHtml(prev => ({
        ...prev,
        twinTargetName: multiTarget.name,
        twinFinalDamage: multiApplyResult?.finalDamage,
        twinTargetCurrentHp: multiApplyResult?.newHp,
        twinTargetMaxHp: multiTarget.type === 'npc'
            ? multiTarget.maxHp
            : (getRuntimeValue(multiTarget.name, 'hitPoints') ?? 0),
    }));
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

function storeSaveLastAttack({ context, campaignName, target, saveResult, saveType, saveDc, formula, name, damageType, adjustedTotal, isSoulstitchProtected, primaryFinalDamage, characterName }) {
    const { attackerName, statusEffects, affectedTargets } = context || {};
    if (!attackerName || !target?.name) {
        console.error('[useLoggedDiceRollDamage] lastAttack missing required fields:', { attackerName, targetName: target?.name, characterName });
    }
    setRuntimeValue('campaign', 'lastAttack', {
        attackerName: attackerName || null,
        targetName: target.name,
        d20: saveResult.roll,
        d20Rolls: saveResult.rawRolls || [saveResult.roll],
        bonus: saveResult.bonus,
        total: saveResult.total,
        rollType: 'attack',
        saveType: saveType || null,
        saveDc: saveDc,
        saveResult: isSoulstitchProtected ? 'success' : (saveResult.success ? 'success' : 'failure'),
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
    }, campaignName);
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

function resolveSaveTargetMaxHp(target) {
    return target?.type === 'player' ? (getRuntimeValue(target.name, 'hitPoints') ?? 0) : target?.maxHp ?? 0;
}

// Roll the target's save and derive evasion/potent-cantrip damage, in the
// original read/log order (evasion log fires mid-block, before damage adjust).
function rollTargetSaveDamage({ context, target, characters, combatSummary, campaignName, characterName, disadvantage, saveType, saveDc, dcSuccess, adjustedTotal, logEntry }) {
    const isSoulstitchProtected = hasSoulstitchProtection(target.name, characterName, campaignName);
    const targetCharacter = (characters || []).find(c => utils.getName(c.name) === target.name);
    const targetSaveModifiers = targetCharacter?.saveModifiers || targetCharacter?.computedStats?.saveModifiers || [];
    const advantage = resolveSaveAdvantage(target, targetSaveModifiers, context, campaignName);
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

    return async function handleNpcSaveDamage(name, formula, total, rolls, modifier, context, adjustedTotal, combatSummary, displayRolls, gwfBaseRolls, gwfDisplayRolls) {
        const { saveDc, saveType, dcSuccess, damageType } = context || {};
        const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
        if (!target) return;
        const targetMaxHp = resolveSaveTargetMaxHp(target);

        const disadvantage = await resolveSaveDisadvantage({
            targetName: target.name,
            campaignName,
            damageType,
            attackerName: characterName,
            attackerStats: context?.playerStats,
            forceDisadvantage: context?.metamagicHeighten || false,
            consumeTargetEffect: true,
        });
        const { targetCharacter, saveResult, advantage, finalDamage, isCantripFlag, hasPotentFlag, isSoulstitchProtected } = rollTargetSaveDamage({
            context, target, characters, combatSummary, campaignName, characterName, disadvantage, saveType, saveDc, dcSuccess, adjustedTotal, logEntry,
        });
        const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;

        const { secondaryResult, secondaryFinalDamage } = await rollAndApplySecondarySaveDamage({
            context, combatSummary, target, saveResult, advantage, isSoulstitchProtected, hasPotentFlag, isCantripFlag, characters, campaignName, characterName, name,
        });

        const primaryApplyResult = secondaryFinalDamage > 0
          ? await applyDamageToTarget(combatSummary, target.name, finalDamage, [damageType], campaignName, characters, ignoreResistance, characterName, true, { concentrationTotalDamage: finalDamage + secondaryFinalDamage })
          : await applyDamageToTarget(combatSummary, target.name, finalDamage, [damageType], campaignName, characters, ignoreResistance, characterName, true);

        applyPostSaveDamageEffects(primaryApplyResult, characterName, campaignName, formula);

        const isCrit = context?.isAutoCrit || false;
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
