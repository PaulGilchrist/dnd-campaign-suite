import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization } from '../../../combat/automation/automationService.js';

const MASS_HEALING_WORD_NAME = 'Mass Healing Word';

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
    if (!healAtSlotLevel) return null;

    let expression = healAtSlotLevel[slotLevel];
    if (!expression) {
        const levels = Object.keys(healAtSlotLevel).map(Number).sort((a, b) => a - b);
        const highestBelow = levels.filter(l => l <= slotLevel).pop();
        if (highestBelow) {
            expression = healAtSlotLevel[highestBelow];
        }
    }
    if (!expression) return null;

    if (spellCastingMod !== null && spellCastingMod !== undefined) {
        expression = expression.replace(/\bMOD\b/g, String(spellCastingMod));
    }
    return expression;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const slotLevel = auto?.slotLevel || playerStats.level || 3;
    const maxTargets = auto?.maxTargets || 6;
    const rangeFt = auto?.range ? await import('../../../rules/combat/rangeValidation.js').then(m => m.rangeToFeet(auto.range)) : 60;

    const spellCastingMod = getSpellCastingMod(playerStats, action.spell);
    const healExpression = resolveHealExpression(action.spell, slotLevel, spellCastingMod);
    if (!healExpression) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: MASS_HEALING_WORD_NAME, description: `${MASS_HEALING_WORD_NAME}: Could not resolve heal expression.` },
        };
    }

    const maximize = hasHealingMaximization(playerStats);
    const result = maximize ? rollExpressionMaximized(healExpression) : rollExpression(healExpression);
    if (!result) {
        return null;
    }

    const { totalBonus: bonusHeal } = resolveHealingBonusesWithDetails(playerStats, playerStats.proficiency || 0, playerStats.level || 1, slotLevel);
    const healAmount = result.total + bonusHeal;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return null;

    const allyNames = getAllyList(playerName);
    const eligible = [];

    for (const allyName of allyNames) {
        if (allyName === playerName) continue;
        const creature = combatSummary.creatures?.find(c => c.name === allyName);
        if (!creature) continue;
        if (await isWithinRange(playerName, allyName, rangeFt)) {
            eligible.push(creature);
        }
    }

    if (eligible.length === 0) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: MASS_HEALING_WORD_NAME, description: `${MASS_HEALING_WORD_NAME}: No allies within range.` },
        };
    }

    if (eligible.length <= maxTargets) {
        return confirmMassHealingWord(action, playerStats, campaignName, eligible.map(c => c.name), healAmount, healExpression, result.rolls, bonusHeal);
    }

    const creatureTargets = eligible.map(c => ({ name: c.name, type: c.type, currentHp: c.currentHp, maxHp: c.maxHp }));

    return {
        type: 'modal',
        modalName: 'massHealingWordTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            maxTargets,
            healAmount,
            healExpression,
            rolls: result.rolls,
            bonusHeal,
        },
    };
}

export async function confirmMassHealingWord(action, playerStats, campaignName, selectedTargetNames, healAmount, healExpression, _rolls, _bonusHeal) {
    const playerName = playerStats.name;
    const maxTargets = action.automation?.maxTargets || 6;
    const finalTargets = selectedTargetNames.slice(0, maxTargets);
    const combatSummary = await getCombatContext(campaignName);
    const results = [];

    for (const targetName of finalTargets) {
        const maxHp = combatSummary?.creatures?.find(c => c.name === targetName)?.maxHp || playerStats.hitPoints || 0;
        const storedHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        const currentHp = storedHp != null && storedHp !== '' ? Number(storedHp) : maxHp;
        const actualHeal = Math.min(healAmount, maxHp - currentHp);

        if (actualHeal > 0) {
            applyHealingToTarget(combatSummary, targetName, actualHeal, campaignName);
        }

        const newHp = Math.min(maxHp, currentHp + actualHeal);

        await addEntry(campaignName, {
            type: 'hp_change',
            targetName,
            delta: actualHeal,
            currentHp: newHp,
            maxHp,
            isHealing: true,
            sourceName: playerName,
            note: MASS_HEALING_WORD_NAME,
            formula: healExpression,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[massHealingWord] Error:', e); });

        results.push({ targetName, healAmount: actualHeal });
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    const totalHealed = results.reduce((sum, r) => sum + r.healAmount, 0);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: MASS_HEALING_WORD_NAME,
            automationType: action.automation.type,
            description: `${MASS_HEALING_WORD_NAME} healed ${totalHealed} HP across ${results.length} target(s): ${finalTargets.join(', ') || 'none'}.`,
        },
    };
}
