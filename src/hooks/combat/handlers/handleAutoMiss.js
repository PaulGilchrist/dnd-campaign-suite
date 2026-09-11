import { rollExpression, formatDamageFormula } from '../../../services/dice/diceRoller.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../../services/combat/automation/automationService.js';
import { hasPotentCantrip, applyMinDamageAdjustment } from '../loggedDiceRollUtils.js';

async function handlePotentCantripHalfDamage({ deps, name, formula, context }) {
    const { characterName, campaignName, characters, setPopupHtml, logEntry } = deps;
    const damageResult = rollExpression(formula);
    if (!damageResult) return false;

    const adjustedPotentTotal = applyMinDamageAdjustment(damageResult.total, damageResult.rolls, context?.playerStats, context?.damageType);
    const halfDamage = Math.floor(adjustedPotentTotal / 2);
    const combatSummary2 = await loadCombatSummary(campaignName);
    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, context?.damageType)) || false;
    const applyResult = await applyDamageToTarget(combatSummary2, context?.targetName, halfDamage, [context?.damageType], campaignName, characters, ignoreResistance, characterName);
    const target = combatSummary2?.creatures?.find(c => c.name === context?.targetName) || null;
    const targetMaxHp = target?.type === 'player'
        ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
        : target?.maxHp ?? 0;
    const isCrit = context?.isAutoCrit || false;
    const displayFormula = isCrit ? formatDamageFormula(formula, damageResult.rolls, true) : formula;
    logEntry({
        type: 'roll',
        characterName,
        rollType: 'cantrip-miss-half-damage',
        name,
        formula: displayFormula,
        rolls: damageResult.rolls,
        total: halfDamage,
        modifier: damageResult.modifier,
        damageType: context?.damageType,
        targetName: context?.targetName,
        isPotentCantrip: true,
        isCrit,
    });
    setPopupHtml({
        type: 'save-damage',
        name,
        formula,
        rolls: damageResult.rolls,
        bonus: damageResult.modifier,
        modifier: damageResult.modifier,
        damageType: context?.damageType,
        targetName: context?.targetName,
        targetCurrentHp: applyResult?.newHp,
        targetMaxHp: targetMaxHp,
        saveDc: context?.saveDc,
        saveType: context?.saveType,
        dcSuccess: 'half',
        total: applyResult?.finalDamage,
        finalDamage: applyResult?.finalDamage,
        damageApplied: true,
        damageReduced: applyResult?.damageReduced,
        isPotentCantrip: true,
        isCrit,
    });
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
