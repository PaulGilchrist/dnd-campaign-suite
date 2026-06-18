import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const PROTECTION_FROM_ENERGY_KEY = 'protectionFromEnergyDamageType';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const playerName = playerStats.name;
    const damageTypes = auto.damageTypes || ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
                automation: auto,
            },
        };
    }

    const creatureTargets = combatSummary.creatures
        .filter(c => c.name !== playerName)
        .map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'protectionFromEnergy_target_selection',
            name: action.name,
            creatureTargets,
            damageTypes,
            automation: auto,
        },
    };
}

export async function applyProtectionFromEnergy(action, playerStats, campaignName, targetName, chosenDamageType) {
    if (!targetName || !chosenDamageType) {
        return null;
    }

    const auto = action.automation || {};
    const duration = auto.duration || 'Concentration, up to 1 hour';
    const damageType = chosenDamageType.charAt(0).toUpperCase() + chosenDamageType.slice(1).toLowerCase();

    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const existingBuff = activeBuffs.find(b => b.name === action.name);

    if (existingBuff) {
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        newBuffs.push({
            name: action.name,
            effect: 'damage_resistance',
            duration,
            resistanceTypes: [damageType],
            sourceCharacter: playerStats.name,
        });
        setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);
    } else {
        const newBuff = {
            name: action.name,
            effect: 'damage_resistance',
            duration,
            resistanceTypes: [damageType],
            sourceCharacter: playerStats.name,
        };
        setRuntimeValue(targetName, 'activeBuffs', [...activeBuffs, newBuff], campaignName);
    }

    setRuntimeValue(targetName, PROTECTION_FROM_ENERGY_KEY, damageType, campaignName);

    addExpiration(playerStats.name, targetName, [
        { type: 'remove_active_buff', buffName: action.name }
    ], campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} cast ${action.name} on ${targetName} for ${damageType} resistance.`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[protectionFromEnergyHandler] Error:", e); throw e; });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} applied to ${targetName}. They now have Resistance to ${damageType} damage.`,
            automation: auto,
        },
    };
}

export function isProtectionFromEnergyActive(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    return activeBuffs.some(b => b.name === 'Protection from Energy' && b.effect === 'damage_resistance');
}

export function getProtectionFromEnergyDamageType(playerName, campaignName) {
    return getRuntimeValue(playerName, PROTECTION_FROM_ENERGY_KEY, campaignName);
}
