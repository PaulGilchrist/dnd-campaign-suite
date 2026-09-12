import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';
import { isDistanceInRange } from '../combat/rangeCheck.js';
import { resolveHealingBonusesWithDetails } from '../../combat/automation/automationService.js';
import { resolveCurrentHp, markFortifiedHealthIfApplied } from './healingWordService.js';

const MASS_HEAL_NAME = 'Mass Heal';
const CONDITIONS_TO_REMOVE = ['blinded', 'deafened', 'poisoned'];

function isMassHeal(spell) {
    return (spell.name || '') === MASS_HEAL_NAME;
}

function getConditionsToRemove(spell) {
    if (spell.status_effects && spell.status_effects.length > 0) {
        return spell.status_effects.map(e => e.toLowerCase());
    }
    return CONDITIONS_TO_REMOVE;
}

async function removeConditionsOnTarget(targetName, campaignName, spell, reason) {
    const conditionsToRemove = getConditionsToRemove(spell);
    if (conditionsToRemove.length === 0) return;

    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const newConditions = conditions.filter(c => !conditionsToRemove.includes(String(c).toLowerCase()));

    if (newConditions.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
        for (const removed of conditionsToRemove) {
            if (!newConditions.some(c => String(c).toLowerCase() === removed)) {
                addEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: removed.charAt(0).toUpperCase() + removed.slice(1),
                    reason,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[massHeal] Error:", e); });
            }
        }
    }
}

function requireCreatures(combatSummary) {
    const x = combatSummary.creatures;
    if (x == null) {
        console.error('[massHealService] Missing array:', x);
        throw new Error('Expected array, got ' + x);
    }
    return x;
}

function getCasterGridPos(combatSummary, casterName) {
    const casterPos = combatSummary.players?.find(p => p.name === casterName);
    return casterPos ? { gridX: casterPos.gridX, gridY: casterPos.gridY } : null;
}

function getCreatureGridPos(combatSummary, name) {
    const targetPlayer = combatSummary.players?.find(p => p.name === name);
    const targetNpc = combatSummary.placedItems?.find(i => i.name === name);
    return {
        gridX: targetPlayer?.gridX ?? targetNpc?.gridX,
        gridY: targetPlayer?.gridY ?? targetNpc?.gridY,
    };
}

// Nearest creatures within range (grid-aware), else the first N non-caster creatures.
function collectTargets(combatSummary, casterName, casterGridPos, rangeFt, maxTargets) {
    const others = requireCreatures(combatSummary).filter(c => c.name !== casterName);
    if (!casterGridPos) {
        return others.slice(0, maxTargets);
    }
    return others
        .map(c => {
            const { gridX, gridY } = getCreatureGridPos(combatSummary, c.name);
            const dist = (gridX != null && gridY != null)
                ? getDistanceFeet(casterGridPos, { gridX, gridY })
                : null;
            return { creature: c, dist };
        })
        .filter(item => isDistanceInRange(item.dist, rangeFt))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, maxTargets)
        .map(item => item.creature);
}

function resolveTotalPool(spell, slotLevel) {
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (!healAtSlotLevel) return 700;
    const expression = healAtSlotLevel[slotLevel] || healAtSlotLevel[Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b).pop()];
    if (!expression || expression === 'max') return 700;
    const parsed = parseInt(expression, 10);
    if (Number.isNaN(parsed)) {
        console.error('[massHealService] triggerMassHeal: heal_at_slot_level expression is not a valid number:', expression)
        throw new Error('heal_at_slot_level expression must be a valid number for mass heal')
    }
    return parsed;
}

function buildHealFormula(totalPool, bonusDetails, targetCount) {
    const formulaParts = [`${totalPool}`];
    if (bonusDetails.length > 0) {
        const bonusParts = bonusDetails.map(d => `${d.amount} ${d.name} × ${targetCount}`).join(' + ');
        formulaParts.push(`(${bonusParts})`);
    }
    return formulaParts.join(' + ');
}

function resolveMassHealSlotLevel(metaCtx, spell) {
    if (metaCtx?.slotLevel == null && spell.level == null) {
        console.error('[massHealService] triggerMassHeal: slot level is missing (metaCtx.slotLevel and spell.level)');
        throw new Error('slot level is required for mass heal');
    }
    return metaCtx?.slotLevel || spell.level;
}

// Heal one target from the shared pool and log the hp_change entry.
// Returns the amount actually healed (the pool drain for this target).
async function healMassHealTarget({ combatSummary, target, playerStats, totalPool, remainingPool, bonusHeal, bonusDetails, targetCount, spell, campaignName }) {
    const targetName = target.name;
    const maxHp = target.maxHp || playerStats.hitPoints || 0;
    const currentHp = resolveCurrentHp(targetName, maxHp, campaignName);
    const healAmount = Math.min(totalPool - (totalPool - remainingPool) + bonusHeal, maxHp - currentHp);
    const actualHeal = Math.min(healAmount, remainingPool);

    if (actualHeal > 0) {
        applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
    }

    const newHp = Math.min(maxHp, currentHp + actualHeal);

    addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: actualHeal,
        currentHp: newHp,
        maxHp,
        isHealing: true,
        sourceName: playerStats.name,
        note: 'Mass Heal',
        formula: buildHealFormula(totalPool, bonusDetails, targetCount),
        bonusDetails: bonusDetails && bonusDetails.length > 0 ? bonusDetails : undefined,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[massHeal] Error:", e); });

    await removeConditionsOnTarget(targetName, campaignName, spell, 'Mass Heal');

    return actualHeal;
}

export async function triggerMassHeal(spell, metaCtx, playerStats, campaignName, _mapName) {
    if (!isMassHeal(spell)) {
        return null;
    }

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return null;
    }

    const casterName = playerStats.name;
    const rangeFt = rangeToFeet(spell.range || '60 feet');
    const casterGridPos = getCasterGridPos(combatSummary, casterName);
    const targets = collectTargets(combatSummary, casterName, casterGridPos, rangeFt, 10);

    if (targets.length === 0) {
        return { noTargets: true };
    }

    const slotLevel = resolveMassHealSlotLevel(metaCtx, spell);
    const totalPool = resolveTotalPool(spell, slotLevel);
    let remainingPool = totalPool;
    const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel, campaignName);
    if (bonusHeal > 0) {
        remainingPool += bonusHeal * targets.length;
    }

    const results = [];
    for (const target of targets) {
        const actualHeal = await healMassHealTarget({ combatSummary, target, playerStats, totalPool, remainingPool, bonusHeal, bonusDetails, targetCount: targets.length, spell, campaignName });
        if (actualHeal > 0) {
            remainingPool -= actualHeal;
        }
        results.push({ targetName: target.name, healAmount: actualHeal });
    }

    await markFortifiedHealthIfApplied(playerStats, campaignName, results.some(r => r.healAmount > 0), bonusDetails);

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { targets: results, totalHealed: results.reduce((sum, r) => sum + r.healAmount, 0), rolls: [], rawTotal: totalPool };
}
