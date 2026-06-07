import { getMaxSorceryPoints, getCurrentSorceryPoints, getLastDamageEvent, spendSorceryPoints, saveLastDamageEvent } from '../../hooks/useMetamagic.js';
import { getChaModifier } from './metamagicRules.js';
import { parseExpression } from '../dice/diceRoller.js';
import { getCombatContext } from './damageUtils.js';
import { applyDamageToTarget } from './applyDamage.js';

export function buildEmpoweredSpellState(playerStats) {
    const name = playerStats.name;
    const maxSP = getMaxSorceryPoints(playerStats);
    const currentSP = getCurrentSorceryPoints(name, maxSP);
    const lastEvent = getLastDamageEvent(name);
    const chaMod = getChaModifier(playerStats);

    const base = {
        type: 'empowered_spell',
        name: 'Metamagic - Empowered Spell',
        currentSP,
        maxSP,
        chaMod,
    };

    if (lastEvent && lastEvent.rolls && lastEvent.damageFormula) {
        const parsed = parseExpression(lastEvent.damageFormula);
        if (!parsed) {
            return {
                ...base,
                lastEvent: null,
                error: 'Could not parse damage formula',
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

export async function executeEmpoweredReroll({ campaignName, playerStats, lastEvent, chaMod }) {
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

    const rerollCount = Math.min(chaMod, originalRolls.length);
    const sortedWithIndex = originalRolls
        .map((r, i) => ({ value: r, index: i }))
        .sort((a, b) => a.value - b.value);
    const rerollIndices = new Set(sortedWithIndex.slice(0, rerollCount).map(x => x.index));

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
        const applyResult = applyDamageToTarget(
            combatSummary,
            lastEvent.targetName,
            damageDifference,
            lastEvent.damageType ? [lastEvent.damageType] : [],
            campaignName,
            null
        );

        saveLastDamageEvent(name, updatedLastEvent, campaignName);

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

    saveLastDamageEvent(name, updatedLastEvent, campaignName);

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

export function getEmpoweredSpellDescription(action) {
    if (action.details) {
        const match = action.details.match(
            /<li><b>Empowered Spell<\/b>\.?\s*([\s\S]*?)<\/li>/i
        );
        if (match) return match[1].trim();
    }
    return 'When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of the damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.';
}
