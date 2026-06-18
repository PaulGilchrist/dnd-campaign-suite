import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';

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
                postLogEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: removed.charAt(0).toUpperCase() + removed.slice(1),
                    reason,
                    timestamp: Date.now(),
                });
            }
        }
    }
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
    const casterPos = combatSummary.players?.find(p => p.name === casterName);
    const casterGridPos = casterPos ? { gridX: casterPos.gridX, gridY: casterPos.gridY } : null;

    const maxTargets = 10;
    const targets = [];

    if (casterGridPos) {
        const sortedCreatures = [...(() => { const x = combatSummary.creatures; if (x == null) { console.error('[massHealService] Missing array:', x); throw new Error('Expected array, got ' + x); } return x; })()]
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
        const eligible = (() => { const x = combatSummary.creatures; if (x == null) { console.error('[massHealService] Missing array:', x); throw new Error('Expected array, got ' + x); } return x; })()
            .filter(c => c.name !== casterName)
            .slice(0, maxTargets);
        targets.push(...eligible);
    }

    if (targets.length === 0) {
        return { noTargets: true };
    }

    const results = [];
    if (metaCtx?.slotLevel == null && spell.level == null) {
        console.error('[massHealService] triggerMassHeal: slot level is missing (metaCtx.slotLevel and spell.level)')
        throw new Error('slot level is required for mass heal')
      }
      const slotLevel = metaCtx?.slotLevel || spell.level;
      const healAtSlotLevel = spell.heal_at_slot_level;
      let totalPool = 700;
      if (healAtSlotLevel) {
        const expression = healAtSlotLevel[slotLevel] || healAtSlotLevel[Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b).pop()];
        if (expression && expression !== 'max') {
          const parsed = parseInt(expression, 10);
          if (Number.isNaN(parsed)) {
            console.error('[massHealService] triggerMassHeal: heal_at_slot_level expression is not a valid number:', expression)
            throw new Error('heal_at_slot_level expression must be a valid number for mass heal')
          }
          totalPool = parsed;
        }
    }
    let remainingPool = totalPool;

    for (const target of targets) {
        const targetName = target.name;
        const maxHp = target.maxHp || playerStats.hitPoints || 0;
        const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
        const healAmount = Math.min(totalPool - (totalPool - remainingPool), maxHp - currentHp);
        const actualHeal = Math.min(healAmount, remainingPool);

        if (actualHeal > 0) {
            applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
            remainingPool -= actualHeal;
        }

        const newHp = Math.min(maxHp, currentHp + actualHeal);

        postLogEntry(campaignName, {
            type: 'hp_change',
            targetName,
            delta: actualHeal,
            currentHp: newHp,
            maxHp,
            isHealing: true,
            sourceName: casterName,
            note: 'Mass Heal',
            timestamp: Date.now(),
        });

        await removeConditionsOnTarget(targetName, campaignName, spell, 'Mass Heal');

        results.push({ targetName, healAmount: actualHeal });
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { targets: results, totalHealed: results.reduce((sum, r) => sum + r.healAmount, 0) };
}
