import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { getDistanceFeet } from '../combat/rangeValidation.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization } from '../../combat/automation/automationService.js';

const MASS_CURE_WOUNDS_NAME = 'Mass Cure Wounds';

function isMassCureWounds(spell) {
    return (spell.name || '') === MASS_CURE_WOUNDS_NAME;
}

function getSpellCastingMod(playerStats, spell) {
    const cantripSpellAbility = spell.spellCastingAbility || playerStats.spellAbilities?.spellCastingAbility;
    if (cantripSpellAbility && playerStats.abilities) {
        const ability = playerStats.abilities.find(a => a.name === cantripSpellAbility);
        if (ability) {
            return ability.bonus;
        }
    }
    if (playerStats.spellAbilities) {
        return playerStats.spellAbilities.modifier || 0;
    }
    return 0;
}

function resolveHealExpression(spell, slotLevel, spellCastingMod) {
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (!healAtSlotLevel) {
        return null;
    }

    let expression = healAtSlotLevel[slotLevel];
    if (!expression) {
        const levels = Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b);
        const highestBelow = levels.filter(l => l <= slotLevel).pop();
        if (highestBelow) {
            expression = healAtSlotLevel[highestBelow];
        }
    }

    if (!expression) {
        return null;
    }

    if (spellCastingMod !== null && spellCastingMod !== undefined) {
        expression = expression.replace(/\bMOD\b/g, String(spellCastingMod));
    }

    return expression;
}

export async function triggerMassCureWounds(spell, metaCtx, playerStats, campaignName, _mapName) {
    if (!isMassCureWounds(spell)) {
        return null;
    }

    const slotLevel = metaCtx?.slotLevel || spell.level || 5;
    const spellCastingMod = getSpellCastingMod(playerStats, spell);
    const healExpression = resolveHealExpression(spell, slotLevel, spellCastingMod);

    if (!healExpression) {
        return null;
    }

    const maximize = hasHealingMaximization(playerStats);
    const result = maximize ? rollExpressionMaximized(healExpression) : rollExpression(healExpression);
    if (!result) {
        return null;
    }

    const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel);
    const healAmount = result.total + bonusHeal;
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return null;
    }

    const casterName = playerStats.name;
    const casterPos = combatSummary.players?.find(p => p.name === casterName);
    const aoeSize = spell.area_of_effect?.size || '30-foot-radius';
    const aoeMatch = aoeSize.match(/(\d+)-foot-radius/);
    const aoeRadius = aoeMatch ? parseInt(aoeMatch[1], 10) : 30;
    const casterGridPos = casterPos ? { gridX: casterPos.gridX, gridY: casterPos.gridY } : null;

    const maxTargets = 6;
    const targets = [];

    if (casterGridPos) {
        const sortedCreatures = [...(() => { const x = combatSummary.creatures; if (x == null) { console.error('[massCureWoundsService] Missing array:', x); throw new Error('Expected array, got ' + x); } return x; })()]
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
            .filter(item => item.dist != null && item.dist <= aoeRadius)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, maxTargets);

        for (const item of sortedCreatures) {
            targets.push(item.creature);
        }
    } else {
        const eligible = (() => { const x = combatSummary.creatures; if (x == null) { console.error('[massCureWoundsService] Missing array:', x); throw new Error('Expected array, got ' + x); } return x; })()
            .filter(c => c.name !== casterName)
            .slice(0, maxTargets);
        targets.push(...eligible);
    }

    if (targets.length === 0) {
        return { noTargets: true };
    }

    const results = [];

    for (const target of targets) {
        const targetName = target.name;
        const maxHp = target.maxHp || playerStats.hitPoints || 0;
        const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
        const actualHeal = Math.min(healAmount, maxHp - currentHp);

        if (actualHeal > 0) {
            applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
        }

        const newHp = Math.min(maxHp, currentHp + actualHeal);

        const formulaParts = [healExpression];
        if (bonusDetails.length > 0) {
            const bonusParts = bonusDetails.map(d => `${d.amount} ${d.name}`).join(' + ');
            formulaParts.push(`(${bonusParts})`);
        }

        postLogEntry(campaignName, {
            type: 'hp_change',
            targetName,
            delta: actualHeal,
            currentHp: newHp,
            maxHp,
            isHealing: true,
            sourceName: casterName,
            note: 'Mass Cure Wounds',
            formula: formulaParts.join(' + '),
            timestamp: Date.now(),
        });

        results.push({ targetName, healAmount: actualHeal });
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { targets: results, formula: healExpression, totalHealed: results.reduce((sum, r) => sum + r.healAmount, 0), rolls: result.rolls, rawTotal: result.total + bonusHeal };
}
