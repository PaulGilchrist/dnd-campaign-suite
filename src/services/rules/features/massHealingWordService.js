import { rollExpression } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';

const MASS_HEALING_WORD_NAME = 'Mass Healing Word';

function isMassHealingWord(spell) {
    return (spell.name || '') === MASS_HEALING_WORD_NAME;
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

export async function triggerMassHealingWord(spell, metaCtx, playerStats, campaignName, _mapName) {
    if (!isMassHealingWord(spell)) {
        return null;
    }

    const slotLevel = metaCtx?.slotLevel || spell.level || 3;
    const spellCastingMod = getSpellCastingMod(playerStats, spell);
    const healExpression = resolveHealExpression(spell, slotLevel, spellCastingMod);

    if (!healExpression) {
        return null;
    }

    const result = rollExpression(healExpression);
    if (!result) {
        return null;
    }

    const healAmount = result.total;
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return null;
    }

    const casterName = playerStats.name;
    const maxTargets = 6;
    const targets = (combatSummary.creatures || [])
        .filter(c => c.name !== casterName)
        .slice(0, maxTargets);

    if (targets.length === 0) {
        return { noTargets: true };
    }

    const results = [];

    for (const target of targets) {
        const targetName = target.name;
        const storedMaxHp = target.maxHp;
        if (storedMaxHp == null) {
            console.error(`[massHealingWordService] maxHp missing for target ${target.name || 'unknown'}`, { stack: new Error().stack });
        }
        const maxHp = storedMaxHp || playerStats.hitPoints || 0;
        const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        let currentHp;
        if (storedHp != null && storedHp !== '') {
            currentHp = Number(storedHp);
        } else {
            console.error(`[massHealingWordService] storedHp not tracked for target ${targetName}, defaulting to maxHp`, { stack: new Error().stack });
            currentHp = maxHp;
        }
        const actualHeal = Math.min(healAmount, maxHp - currentHp);

        if (actualHeal > 0) {
            applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
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
            note: 'Mass Healing Word',
            formula: healExpression,
            timestamp: Date.now(),
        });

        results.push({ targetName, healAmount: actualHeal });
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { targets: results, formula: healExpression, totalHealed: results.reduce((sum, r) => sum + r.healAmount, 0) };
}
