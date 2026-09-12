import { rollExpression, formatDamageFormula } from '../../../services/dice/diceRoller.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../../services/combat/automation/automationService.js';
import { hasPotentCantrip, applyMinDamageAdjustment } from '../loggedDiceRollUtils.js';

function resolveAutoMissTargetMaxHp(target) {
    if (!target) return 0;
    return target.type === 'player' ? (getRuntimeValue(target.name, 'hitPoints') ?? 0) : target.maxHp ?? 0;
}

function buildPotentHalfLogEntry({ characterName, name, damageResult, halfDamage, targetName, damageType, displayFormula, isCrit }) {
    return {
        type: 'roll',
        characterName,
        rollType: 'cantrip-miss-half-damage',
        name,
        formula: displayFormula,
        rolls: damageResult.rolls,
        total: halfDamage,
        modifier: damageResult.modifier,
        damageType,
        targetName,
        isPotentCantrip: true,
        isCrit,
    };
}

function buildPotentHalfPopup({ name, formula, damageResult, applyResult, targetMaxHp, targetName, damageType, saveDc, saveType, isCrit }) {
    return {
        type: 'save-damage',
        name,
        formula,
        rolls: damageResult.rolls,
        bonus: damageResult.modifier,
        modifier: damageResult.modifier,
        damageType,
        targetName,
        targetCurrentHp: applyResult?.newHp,
        targetMaxHp,
        saveDc,
        saveType,
        dcSuccess: 'half',
        total: applyResult?.finalDamage,
        finalDamage: applyResult?.finalDamage,
        damageApplied: true,
        damageReduced: applyResult?.damageReduced,
        isPotentCantrip: true,
        isCrit,
    };
}

async function handlePotentCantripHalfDamage({ deps, name, formula, context }) {
    const { characterName, campaignName, characters, setPopupHtml, logEntry } = deps;
    const { targetName, damageType, playerStats, saveDc, saveType, isAutoCrit } = context || {};
    const damageResult = rollExpression(formula);
    if (!damageResult) return false;

    const adjustedPotentTotal = applyMinDamageAdjustment(damageResult.total, damageResult.rolls, playerStats, damageType);
    const halfDamage = Math.floor(adjustedPotentTotal / 2);
    const combatSummary2 = await loadCombatSummary(campaignName);
    const ignoreResistance = (playerStats && hasIgnoreResistance(playerStats, damageType)) || false;
    const applyResult = await applyDamageToTarget(combatSummary2, targetName, halfDamage, [damageType], campaignName, characters, { ignoreResistance: ignoreResistance, attackerName: characterName });
    const target = combatSummary2?.creatures?.find(c => c.name === targetName) || null;
    const isCrit = isAutoCrit || false;
    const displayFormula = isCrit ? formatDamageFormula(formula, damageResult.rolls, true) : formula;
    logEntry(buildPotentHalfLogEntry({ characterName, name, damageResult, halfDamage, targetName, damageType, displayFormula, isCrit }));
    setPopupHtml(buildPotentHalfPopup({ name, formula, damageResult, applyResult, targetMaxHp: resolveAutoMissTargetMaxHp(target), targetName, damageType, saveDc, saveType, isCrit }));
    return true;
}

function buildAutoMissLastAttack({ characterName, name, formula, context }) {
    return {
        attackerName: characterName,
        targetName: context?.targetName || null,
        rollType: 'auto-miss',
        damageFormula: formula || null,
        damageName: name || null,
        damageType: context?.damageType || null,
        rawDamage: 0,
        primaryDamage: 0,
        primaryDamageType: context?.damageType || null,
        actualDamage: 0,
        damageApplied: false,
        statusEffects: context?.statusEffects || null,
        affectedTargets: context?.affectedTargets || [context?.targetName].filter(Boolean),
        rangeReason: context?.rangeReason,
        timestamp: Date.now(),
    };
}

export function createAutoMissHandler(deps) {
    const { characterName, campaignName, setPopupHtml, logEntry } = deps;

    return async function handleAutoMiss(name, formula, total, rolls, modifier, context) {
        const isCantripFlag = context?.isCantrip || false;
        const hasPotentFlag = hasPotentCantrip(context?.playerStats);

        if (hasPotentFlag && isCantripFlag) {
            const handled = await handlePotentCantripHalfDamage({ deps, name, formula, context });
            if (handled) return;
        }

        const isCrit = context?.isAutoCrit || false;
        const displayFormula = isCrit ? formatDamageFormula(formula, rolls, true) : formula;
        logEntry({
            type: 'roll',
            characterName,
            rollType: 'auto-miss-damage',
            name,
            formula: displayFormula,
            rolls,
            total,
            modifier,
            damageType: context?.damageType,
            targetName: context?.targetName,
            rangeReason: context?.rangeReason,
            isCrit,
        });
        setPopupHtml({
            type: 'auto-miss',
            name,
            formula,
            rolls,
            bonus: 0,
            modifier,
            damageType: context?.damageType,
            targetName: context?.targetName,
            rangeReason: context?.rangeReason,
        });

        // Write lastAttack for auto-miss — counterspell needs to know about it
        setRuntimeValue('campaign', 'lastAttack', buildAutoMissLastAttack({ characterName, name, formula, context }), campaignName);
    };
}
