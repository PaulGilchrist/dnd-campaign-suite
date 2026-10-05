import { getMaxSorceryPoints, getCurrentSorceryPoints, spendSorceryPoints, logMetamagicUse } from '../../../hooks/combat/useMetamagic.js';
import { getChaModifier } from './metamagicRules.js';
import { parseExpression } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyDamageToTarget } from '../combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../features/invisibilityService.js';
import { findLastAttack } from '../../automation/common/damageRollback.js';

export async function buildEmpoweredSpellState(playerStats) {
    const name = playerStats.name;
    const maxSP = getMaxSorceryPoints(playerStats);
    const currentSP = getCurrentSorceryPoints(name, maxSP);
    const attackResult = await findLastAttack();
    const lastEvent = attackResult.attackEvent;
    const chaMod = getChaModifier(playerStats);

    const base = {
        type: 'empowered_spell',
        name: 'Metamagic - Empowered Spell',
        currentSP,
        maxSP,
        chaMod,
    };

    if (lastEvent && lastEvent.damageTypes?.length && lastEvent.damageFormula) {
        const parsed = parseExpression(lastEvent.damageFormula);
        if (!parsed) {
            return {
                ...base,
                lastEvent: null,
                error: 'Could not parse damage formula',
            };
        }
        if (playerStats.rules === '2024') {
            return {
                ...base,
                lastEvent,
                maxReroll: (lastEvent.rolls || []).filter(r => r <= 2).length,
                formulaParsed: parsed,
            };
        }
        return {
            ...base,
            lastEvent,
            chaMod: Math.min(chaMod, parsed.count),
            formulaParsed: parsed,
        };
    }

    return {
        ...base,
        lastEvent: null,
        error: lastEvent
            ? 'No dice roll data available'
            : 'No recent damage event found. Cast a spell that deals damage first.',
    };
}

export async function executeEmpoweredReroll({ campaignName, playerStats, lastEvent, chaMod, characters }) {
    const parsed = parseExpression(lastEvent.damageFormula);
    if (!parsed) return null;

    const name = playerStats.name;
    const maxSP = getMaxSorceryPoints(playerStats);
    const currentSP = getCurrentSorceryPoints(name, maxSP);

    if (currentSP < 1) {
        return {
            popupState: {
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP,
                maxSP,
                lastEvent,
                chaMod,
                error: 'Not enough sorcery points. Empowered Spell costs 1 SP.',
            },
        };
    }

    const { sides, modifier } = parsed;
    const originalRolls = lastEvent.rolls || [];

    let rerollIndices;
    if (playerStats.rules === '2024') {
        rerollIndices = new Set(
            originalRolls
                .map((r, i) => ({ value: r, index: i }))
                .filter(x => x.value <= 2)
                .map(x => x.index)
        );
        if (rerollIndices.size === 0) {
            return {
                popupState: {
                    type: 'empowered_spell',
                    name: 'Metamagic - Empowered Spell',
                    currentSP,
                    maxSP,
                    lastEvent,
                    chaMod,
                    error: 'No damage dice showing 1 or 2 to reroll.',
                },
            };
        }
    } else {
        const sortedWithIndex = originalRolls
            .map((r, i) => ({ value: r, index: i }))
            .sort((a, b) => a.value - b.value);
        rerollIndices = new Set(sortedWithIndex.slice(0, Math.min(chaMod, originalRolls.length)).map(x => x.index));
    }
    const rerollCount = rerollIndices.size;

    const newRolls = originalRolls.map((r, i) =>
        rerollIndices.has(i) ? Math.floor(Math.random() * sides) + 1 : r
    );
    const newTotal = newRolls.reduce((sum, r) => sum + r, 0) + modifier;
    const damageDifference = newTotal - lastEvent.rawDamage;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary || !lastEvent.targetName) {
        return {
            popupState: {
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP,
                maxSP,
                lastEvent,
                chaMod,
                error: 'No combat summary found. Cannot reapply damage.',
            },
        };
    }

    spendSorceryPoints(name, 1, campaignName, maxSP);
    logMetamagicUse(campaignName, name, lastEvent.spellName, ['Empowered Spell'], 1);

    const logEntry = {
        type: 'metamagic',
        characterName: name,
        rollType: 'empowered-spell',
        spellName: lastEvent.spellName,
        originalDamage: lastEvent.rawDamage,
        newTotal,
        damageDifference,
        targetName: lastEvent.targetName,
        rerolledDiceCount: rerollCount,
        originalDice: originalRolls,
        newDice: newRolls,
    };

    const updatedLastEvent = {
        ...lastEvent,
        rawDamage: newTotal,
        rolls: newRolls,
        timestamp: Date.now(),
    };

    if (damageDifference !== 0) {
        const applyResult = applyDamageToTarget(combatSummary, lastEvent.targetName, damageDifference, lastEvent.damageTypes ? lastEvent.damageTypes : [], { campaignName, characters: characters, ignoreResistance: false, attackerName: name });

        if (applyResult && applyResult.finalDamage > 0) {
            endInvisibilityOnHostileAction(name, campaignName);
        }

        return {
            logEntries: [logEntry],
            popupState: {
                type: 'empowered_spell',
                name: 'Metamagic - Empowered Spell',
                currentSP: currentSP - 1,
                maxSP,
                lastEvent: updatedLastEvent,
                chaMod,
                result: {
                    oldTotal: lastEvent.rawDamage,
                    newTotal,
                    damageDifference,
                    rerollCount,
                    rerolledDice: rerollIndices,
                    originalDice: originalRolls,
                    newDice: newRolls,
                    targetCurrentHp: applyResult?.newHp,
                },
                completed: true,
            },
        };
    }

    return {
        logEntries: [logEntry],
        popupState: {
            type: 'empowered_spell',
            name: 'Metamagic - Empowered Spell',
            currentSP: currentSP - 1,
            maxSP,
            lastEvent: updatedLastEvent,
            chaMod,
            result: {
                oldTotal: lastEvent.rawDamage,
                newTotal,
                damageDifference: 0,
                rerollCount,
                message: 'Reroll did not change the damage total.',
            },
            completed: true,
        },
    };
}

export function hasEmpoweredSpell(playerStats) {
    if (!playerStats) return false;
    const metamagicAction = playerStats.actions?.find(a => a.name === 'Metamagic' && a.automation?.type === 'spell_modifier');
    if (!metamagicAction) return false;
    const options = metamagicAction.automation.options || [];
    return options.some(o => o.effect === 'reroll_damage_dice');
}

export function getEmpoweredSpellDescription(action, rules) {
    if (action.details) {
        const match = action.details.match(
            /<li><b>Empowered Spell<\/b>\.?\s*([\s\S]*?)<\/li>/i
        );
        if (match) return match[1].trim();
    }
    if (rules === '2024') {
        return 'When you roll damage for a spell, you can spend 1 sorcery point to reroll any number of those dice that rolled a 1 or a 2. You must use the new rolls.';
    }
    return 'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.';
}
