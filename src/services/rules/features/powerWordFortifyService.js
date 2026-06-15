import { rollExpression } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { rangeToFeet } from '../combat/rangeValidation.js';
import { getDistanceFeet } from '../combat/rangeValidation.js';

const POWER_WORD_FORTIFY_NAME = 'Power Word Fortify';

function isPowerWordFortify(spell) {
    return (spell.name || '') === POWER_WORD_FORTIFY_NAME;
}

function resolveTempHpExpression(spell, slotLevel) {
    const auto = spell.automation;
    if (!auto?.tempHpExpression) {
        return '120';
    }

    let expression = auto.tempHpExpression;
    const resolvedSlot = slotLevel || spell.level || 7;

    expression = expression.replace(/spellSlotLevel/g, String(resolvedSlot));

    return expression;
}

export async function triggerPowerWordFortify(spell, metaCtx, playerStats, campaignName, _mapName) {
    if (!isPowerWordFortify(spell)) {
        return null;
    }

    const slotLevel = metaCtx?.slotLevel || spell.level || 7;
    const tempHpExpression = resolveTempHpExpression(spell, slotLevel);

    const result = rollExpression(tempHpExpression);
    if (!result) {
        return null;
    }

    const totalTempHp = result.total;
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return null;
    }

    const casterName = playerStats.name;
    const maxTargets = spell.automation?.maxTargets || 6;
    const rangeFt = rangeToFeet(spell.automation?.range || spell.range || '60 feet');

    let targets = [];

    if (rangeFt != null) {
        const casterPos = combatSummary.players?.find(p => p.name === casterName);
        const casterGridPos = casterPos ? { gridX: casterPos.gridX, gridY: casterPos.gridY } : null;

        if (casterGridPos) {
            targets = [...(combatSummary.creatures || [])]
                .filter(c => c.name !== casterName)
                .map(c => {
                    const targetPlayer = combatSummary.players?.find(p => p.name === c.name);
                    const targetNpc = combatSummary.placedItems?.find(i => i.name === c.name);
                    const targetGridX = targetPlayer?.gridX ?? targetNpc?.gridX;
                    const targetGridY = targetPlayer?.gridY ?? targetNpc?.gridY;
                    const dist = (targetGridX != null && targetGridY != null)
                        ? getDistanceFeet(casterGridPos, { gridX: targetGridX, gridY: targetGridY })
                        : null;
                    return { creature: c, dist };
                })
                .filter(item => item.dist != null && item.dist <= rangeFt)
                .sort((a, b) => a.dist - b.dist)
                .slice(0, maxTargets)
                .map(item => item.creature);
        } else {
            targets = (combatSummary.creatures || [])
                .filter(c => c.name !== casterName)
                .slice(0, maxTargets);
        }
    } else {
        targets = (combatSummary.creatures || [])
            .filter(c => c.name !== casterName)
            .slice(0, maxTargets);
    }

    if (targets.length === 0) {
        return { noTargets: true };
    }

    const results = [];
    const perTarget = Math.floor(totalTempHp / targets.length);
    let remaining = totalTempHp - (perTarget * targets.length);

    for (const target of targets) {
        const targetName = target.name;
        const currentTempHp = Number(getRuntimeValue(targetName, 'tempHp', campaignName) ?? 0);
        const grantAmount = perTarget + (remaining > 0 ? 1 : 0);
        if (remaining > 0) remaining--;

        const newTempHp = currentTempHp + grantAmount;
        setRuntimeValue(targetName, 'tempHp', newTempHp, campaignName);

        postLogEntry(campaignName, {
            type: 'hp_change',
            targetName,
            delta: grantAmount,
            currentHp: null,
            maxHp: null,
            isHealing: false,
            isTempHp: true,
            sourceName: casterName,
            note: POWER_WORD_FORTIFY_NAME,
            formula: tempHpExpression,
            timestamp: Date.now(),
        });

        results.push({ targetName, tempHpAmount: grantAmount });
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { targets: results, formula: tempHpExpression, totalGranted: totalTempHp };
}
