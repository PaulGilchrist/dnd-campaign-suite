import { rollExpression, rollExpressionMaximized, applyHealingRerollOnes } from '../../dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximizationForTarget, hasRerollHealingOnes, markFortifiedHealthUsed } from '../../combat/automation/automationService.js';

const HEALING_WORD_NAME = 'Healing Word';

function isHealingWord(spell) {
    return (spell.name || '') === HEALING_WORD_NAME;
}

// Caster's spellcasting modifier for the Healing Word expression: named
// ability from the spell/character, else the spellAbilities modifier.
function resolveSpellCastingMod(spell, playerStats) {
    const cantripSpellAbility = spell.spellCastingAbility || playerStats.spellAbilities?.spellCastingAbility;
    let spellCastingMod = 0;
    if (cantripSpellAbility && playerStats.abilities) {
        const ability = playerStats.abilities.find(a => a.name === cantripSpellAbility);
        if (ability) {
            spellCastingMod = ability.bonus;
        }
    } else if (playerStats.spellAbilities) {
        spellCastingMod = playerStats.spellAbilities.modifier || 0;
    }
    return spellCastingMod;
}

// Roll the healing expression (maximized when requested) and apply the
// reroll-healing-ones pass when it applies.
function rollHealingWordExpression(healExpression, maximize, rerollOnes) {
    const result = maximize ? rollExpressionMaximized(healExpression) : rollExpression(healExpression);
    let displayRolls = result?.rolls || null;
    let healingRerollOriginalRolls = null;
    if (result && rerollOnes && !maximize) {
        const { displayRolls: rerolled, originalRolls } = applyHealingRerollOnes(result.rolls, healExpression);
        displayRolls = rerolled;
        healingRerollOriginalRolls = originalRolls;
    }
    return { result, displayRolls, healingRerollOriginalRolls };
}

// Target's current/max HP: max from combat summary (falling back to the
// caster's hit points), current from the runtime store.
function resolveTargetHp(combatSummary, targetName, playerStats, campaignName) {
    const maxHp = combatSummary.creatures.find(c => c.name === targetName)?.maxHp || playerStats.hitPoints || 0;
    const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
    return { maxHp, currentHp };
}

export async function triggerHealingWord(spell, metaCtx, playerStats, campaignName, _mapName) {
    if (!isHealingWord(spell)) {
        return null;
    }

    const slotLevel = metaCtx?.slotLevel || spell.level || 1;
    const healAtSlotLevel = spell.heal_at_slot_level;
    if (!healAtSlotLevel || !healAtSlotLevel[slotLevel]) {
        return null;
    }

    let healExpression = healAtSlotLevel[slotLevel];

    const spellCastingMod = resolveSpellCastingMod(spell, playerStats);
    if (spellCastingMod !== undefined) {
        healExpression = healExpression.replace(/\bMOD\b/g, String(spellCastingMod));
    }

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return null;

    const targetName = metaCtx?.targetName || (getTargetFromAttacker(combatSummary, playerStats.name)?.name);
    if (!targetName) return null;

    const maximize = hasHealingMaximizationForTarget(playerStats, targetName, campaignName);
    const rerollOnes = hasRerollHealingOnes(playerStats);
    const { result, displayRolls, healingRerollOriginalRolls } = rollHealingWordExpression(healExpression, maximize, rerollOnes);
    if (!result) return null;

    const { totalBonus: bonusHeal, details: bonusDetails } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel, campaignName);
    const healAmount = result.total + bonusHeal;
    const { maxHp, currentHp } = resolveTargetHp(combatSummary, targetName, playerStats, campaignName);
    const actualHeal = Math.min(healAmount, maxHp - currentHp);

    if (actualHeal > 0) {
        applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
    }

    const newHp = Math.min(maxHp, currentHp + actualHeal);

    if (actualHeal > 0 && bonusDetails?.some(d => d.name === 'Fortified Health')) {
        await markFortifiedHealthUsed(playerStats, campaignName);
    }

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
        sourceName: playerStats.name,
        note: 'Healing Word',
        formula: formulaParts.join(' + '),
        bonusDetails: bonusDetails && bonusDetails.length > 0 ? bonusDetails : undefined,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[healingWord] Error:", e); });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { targetName, healAmount: actualHeal, formula: healExpression, rolls: displayRolls || result.rolls, rawTotal: result.total + bonusHeal, healingRerollOriginalRolls, healingRerollDisplayRolls: displayRolls };
}
