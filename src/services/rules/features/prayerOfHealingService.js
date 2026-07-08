import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization } from '../../combat/automation/automationService.js';

const PRAYER_OF_HEALING_NAME = 'Prayer of Healing';

function isPrayerOfHealing(spell) {
    return (spell.name || '') === PRAYER_OF_HEALING_NAME;
}

function getHealExpression(spell) {
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (healAtSlotLevel) {
        const slotLevel = Object.keys(healAtSlotLevel)
            .map(Number)
            .sort((a, b) => a - b)
            .filter(l => l >= spell.level)
            .shift();
        if (slotLevel && healAtSlotLevel[slotLevel]) {
            return healAtSlotLevel[slotLevel];
        }
        const keys = Object.keys(healAtSlotLevel);
        if (keys.length > 0) {
            return healAtSlotLevel[keys[0]];
        }
    }
    return '2d8';
}

function getAffectedKey(targetName) {
    return `prayerOfHealing_lastUsedRound_${targetName}`;
}

function isAffectedByPrayerOfHealing(targetName, campaignName) {
    const usedRound = getRuntimeValue(targetName, getAffectedKey(targetName), campaignName);
    if (!usedRound) return false;
    const currentRound = getCurrentCombatRound();
    return usedRound === currentRound;
}

function markPrayerOfHealingUsed(targetName, campaignName) {
    const currentRound = getCurrentCombatRound();
    setRuntimeValue(targetName, getAffectedKey(targetName), currentRound, campaignName);
}

export async function triggerPrayerOfHealing(spell, metaCtx, playerStats, campaignName, _mapName) {
    if (!isPrayerOfHealing(spell)) {
        return null;
    }

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return null;
    }

    const casterName = playerStats.name;
    const rangeFt = rangeToFeet(spell.range || '30 feet');
    const casterPos = combatSummary.players?.find(p => p.name === casterName);
    const casterGridPos = casterPos ? { gridX: casterPos.gridX, gridY: casterPos.gridY } : null;

    const maxTargets = 5;
    const targets = [];

    if (casterGridPos) {
        const sortedCreatures = [...(() => { const x = combatSummary.creatures; if (x == null) { console.error('[prayerOfHealingService] Missing array:', x); throw new Error('Expected array, got ' + x); } return x; })()]
            .filter(c => c.name !== casterName)
            .map(c => {
                const targetPlayer = combatSummary.players?.find(p => p.name === c.name);
                const targetNpc = combatSummary.placedItems?.find(i => i.name === c.name);
                const targetGridX = targetPlayer?.gridX ?? targetNpc?.gridX;
                const targetGridY = targetPlayer?.gridY ?? targetNpc?.gridY;
                const dist = (targetGridX != null && targetGridY != null)
                    ? getDistanceFeet(casterGridPos, { gridX: targetGridX, gridY: targetGridY })
                    : null;
                return { creature: c, dist, gridX: targetGridX, gridY: targetGridY };
            })
            .filter(item => item.dist != null && item.dist <= rangeFt)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, maxTargets);

        for (const item of sortedCreatures) {
            targets.push(item.creature);
        }
    } else {
        const eligible = (() => { const x = combatSummary.creatures; if (x == null) { console.error('[prayerOfHealingService] Missing array:', x); throw new Error('Expected array, got ' + x); } return x; })()
            .filter(c => c.name !== casterName)
            .slice(0, maxTargets);
        targets.push(...eligible);
    }

    if (targets.length === 0) {
        return { noTargets: true };
    }

    const healExpression = getHealExpression(spell);
    const maximize = hasHealingMaximization(playerStats);
    const result = maximize ? rollExpressionMaximized(healExpression) : rollExpression(healExpression);
    if (!result) {
        return null;
    }

    const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, 1);
    const healAmount = result.total + bonusHeal;
    const results = [];

    for (const target of targets) {
        const targetName = target.name;

        if (isAffectedByPrayerOfHealing(targetName, campaignName)) {
            continue;
        }

        const maxHp = target.maxHp || playerStats.hitPoints || 0;
        const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
        const actualHeal = Math.min(healAmount, maxHp - currentHp);

        if (actualHeal > 0) {
            applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
            markPrayerOfHealingUsed(targetName, campaignName);
        }

        const newHp = Math.min(maxHp, currentHp + actualHeal);

        const formulaParts = [healExpression];
        if (bonusDetails.length > 0) {
            const bonusParts = bonusDetails.map(d => `${d.amount} ${d.name}`).join(' + ');
            formulaParts.push(`(${bonusParts})`);
        }

        addEntry(campaignName, {
            type: 'hp_change',
            targetName,
            delta: actualHeal,
            currentHp: newHp,
            maxHp,
            isHealing: true,
            sourceName: casterName,
            note: 'Prayer of Healing',
            formula: formulaParts.join(' + '),
            timestamp: Date.now(),
        }).catch((e) => { console.error("[prayerOfHealing] Error:", e); });

        addEntry(campaignName, {
            type: 'prayer_of_healing',
            targetName,
            casterName,
            isAffected: true,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[prayerOfHealing] Error:", e); });

        results.push({ targetName, healAmount: actualHeal });
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { targets: results, formula: healExpression, totalHealed: results.reduce((sum, r) => sum + r.healAmount, 0), rolls: result.rolls, rawTotal: result.total + bonusHeal };
}
