import { rollExpression } from '../../dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';

const HEALING_WORD_NAME = 'Healing Word';

function isHealingWord(spell) {
    return (spell.name || '') === HEALING_WORD_NAME;
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

    if (spellCastingMod !== undefined) {
        healExpression = healExpression.replace(/\bMOD\b/g, String(spellCastingMod));
    }

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return null;

    const targetName = metaCtx?.targetName || (getTargetFromAttacker(combatSummary, playerStats.name)?.name);
    if (!targetName) return null;

    const result = rollExpression(healExpression);
    if (!result) return null;

    const healAmount = result.total;
    const creatures = combatSummary?.creatures;
    if (creatures == null) {
        console.error(`[healingWordService] combatSummary.creatures missing`, { stack: new Error().stack });
    }
    const creaturesArr = creatures || [];
    const foundCreature = creaturesArr.find(c => c.name === targetName);
    const creatureMaxHp = foundCreature?.maxHp;
    if (creatureMaxHp == null) {
        console.error(`[healingWordService] maxHp missing for target ${targetName}`, { stack: new Error().stack });
    }
    const maxHp = creatureMaxHp || playerStats.hitPoints || 0;
    const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
    let currentHp;
    if (storedHp != null && storedHp !== '') {
        currentHp = Number(storedHp);
    } else {
        console.error(`[healingWordService] storedHp not tracked for target ${targetName}, defaulting to maxHp`, { stack: new Error().stack });
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
        sourceName: playerStats.name,
        note: 'Healing Word',
        formula: healExpression,
        timestamp: Date.now(),
    });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return { targetName, healAmount: actualHeal, formula: healExpression };
}
