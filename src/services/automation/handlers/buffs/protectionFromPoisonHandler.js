import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

const SPELL_NAME = 'Protection from Poison';
const EFFECT_KEY = 'protection_from_poison';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};

    const combatSummary = getCombatSummary(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
            },
        };
    }

    const casterName = playerStats.name;
    const allCreatureNames = combatSummary.creatures.map(c => c.name);
    if (!allCreatureNames.includes(casterName)) {
        allCreatureNames.unshift(casterName);
    }

    return {
        type: 'popup',
        payload: {
            type: 'protection_from_poison_target_selection',
            name: SPELL_NAME,
            creatureTargets: allCreatureNames,
            range: auto.range || 'Touch',
            automation: auto,
        },
    };
}

export async function applyProtectionFromPoison(action, playerStats, campaignName, _mapName, result) {
    if (!result || !result.targetName) {
        return null;
    }

    const targetName = result.targetName;
    const casterName = playerStats.name;
    const auto = action.automation || {};
    const duration = auto.duration || '1 hour';

    // Remove Poisoned condition from target
    const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const filtered = conditions.filter(c => !conditionMatches(String(c), 'poisoned'));

    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    }

    // Add active buff with poison resistance
    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const existingBuff = activeBuffs.find(b => b.name === SPELL_NAME);

    const newBuff = {
        name: SPELL_NAME,
        effect: EFFECT_KEY,
        duration,
        sourceCharacter: casterName,
        resistanceTypes: ['Poison'],
        saveAdvantageTypes: ['poisoned'],
    };

    if (existingBuff) {
        const newBuffs = activeBuffs.filter(b => b.name !== SPELL_NAME);
        newBuffs.push(newBuff);
        setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);
    } else {
        setRuntimeValue(targetName, 'activeBuffs', [...activeBuffs, newBuff], campaignName);
    }

    // Register target effect for badge rendering
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const existingFiltered = storedEffects.filter(te => {
        const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
        return !(teTarget === targetName && te.effect === EFFECT_KEY && te.source === casterName);
    });
    const newEffect = {
        target: targetName,
        effect: EFFECT_KEY,
        source: casterName,
        duration,
    };
    setRuntimeValue('campaign', 'targetEffects', [...existingFiltered, newEffect], campaignName);

    // SP-095: no concentration registered — spell data says concentration:false
    // (RAW 2024 Protection from Poison does not require concentration).

    // Register expiration: expires on initiative roll, short rest, long rest
    addExpiration({ attackerName: casterName, targetName, effects: [
        { type: 'remove_active_buff', buffName: SPELL_NAME },
        { type: 'remove_target_effect', effectKey: EFFECT_KEY, source: casterName },
    ], campaignName, rounds: Infinity, expireOnCreatureName: targetName });

    // Log to campaign
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: SPELL_NAME,
        description: `${casterName} cast ${SPELL_NAME} on ${targetName}. Poisoned condition removed. Target has Advantage on saving throws vs Poisoned and Resistance to Poison damage. Duration 1 hour, no concentration. Expires on initiative roll, short rest, or long rest.`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[protectionFromPoisonHandler] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: SPELL_NAME,
            automationType: auto.type,
            description: `${SPELL_NAME} applied to ${targetName}. Poisoned condition removed. Target has Advantage on saving throws vs Poisoned and Resistance to Poison damage.`,
            automation: auto,
        },
    };
}

export function isProtectionFromPoisonActive(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    return activeBuffs.some(b => b.name === SPELL_NAME && b.effect === EFFECT_KEY);
}
