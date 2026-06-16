import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { addExpiration } from '../../rules/effects/expirations.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};

    const combatSummary = await getCombatContext(campaignName);
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

    const creatureTargets = combatSummary.creatures
        .filter(c => c.name !== playerStats.name)
        .map(c => {
            const conditions = getRuntimeValue(c.name, 'activeConditions') || [];
            const hasPoisoned = conditions.some(cond => conditionMatches(String(cond), 'poisoned'));
            return {
                name: c.name,
                hasPoisoned,
            };
        });

    const selfConditions = getRuntimeValue(playerStats.name, 'activeConditions') || [];
    const selfHasPoisoned = selfConditions.some(cond => conditionMatches(String(cond), 'poisoned'));

    const allTargets = [
        { name: playerStats.name, hasPoisoned: selfHasPoisoned, isSelf: true },
        ...creatureTargets,
    ];

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Select a target to protect.`,
            automation: auto,
            targets: allTargets,
            range: auto.range || 'Touch',
        },
    };
}

export async function applyProtectionFromPoison(action, playerStats, campaignName, _mapName, result) {
    if (!result || !result.targetName) {
        return null;
    }

    const targetName = result.targetName;
    const auto = action.automation || {};
    const duration = auto.duration || '1 hour';

    // Remove Poisoned condition from target
    const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const filtered = conditions.filter(c => !conditionMatches(String(c), 'poisoned'));

    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);

        const combatSummary = await getCombatContext(campaignName);
        if (combatSummary) {
            const creature = combatSummary.creatures?.find(c => c.name === targetName);
            if (creature && Array.isArray(creature.conditions)) {
                creature.conditions = creature.conditions.filter(c => !conditionMatches(String(c.key), 'poisoned'));
            }
        }
    }

    // Add active buff with save advantage for poisoned and poison resistance
    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const existingBuff = activeBuffs.find(b => b.name === action.name);

    const newBuff = {
        name: action.name,
        effect: 'protection_from_poison',
        duration,
        sourceCharacter: playerStats.name,
        resistanceTypes: ['Poison'],
    };

    if (existingBuff) {
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        newBuffs.push(newBuff);
        setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);
    } else {
        setRuntimeValue(targetName, 'activeBuffs', [...activeBuffs, newBuff], campaignName);
    }

    addExpiration(playerStats.name, targetName, [
        { type: 'remove_active_buff', buffName: action.name }
    ], campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} cast ${action.name} on ${targetName}. Poisoned condition removed. Target has Advantage on saves vs Poisoned and Resistance to Poison damage for ${duration}.`,
        targetName,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} applied to ${targetName}. Poisoned condition removed. Target has Advantage on saving throws vs Poisoned and Resistance to Poison damage.`,
            automation: auto,
        },
    };
}

export function isProtectionFromPoisonActive(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    return activeBuffs.some(b => b.name === 'Protection from Poison' && b.effect === 'protection_from_poison');
}
