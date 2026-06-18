import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const DAMAGE_TYPES = [
    'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
    'Necrotic', 'Piercing', 'Poison', 'Radiant', 'Slashing', 'Thunder'
];

const RESISTANCE_CHOOSE_KEY = 'resistanceChosenDamageType';
const RESISTANCE_USED_KEY = 'resistanceUsedThisTurn';

export async function handle(action, playerStats, campaignName, _mapName) {
    const playerName = playerStats.name;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
                automation: action.automation || {},
            },
        };
    }

    const creatureTargets = combatSummary.creatures
        .filter(c => c.name !== playerName)
        .map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'resistance_target_selection',
            name: action.name,
            creatureTargets,
            damageTypes: DAMAGE_TYPES,
            automation: action.automation || {},
        },
    };
}

export async function applyResistance(action, playerStats, campaignName, targetName, chosenDamageType) {
    if (!targetName || !chosenDamageType) {
        return null;
    }

    const auto = action.automation || {};
    const duration = auto.duration || 'Concentration, up to 1 minute';
    const damageType = chosenDamageType.charAt(0).toUpperCase() + chosenDamageType.slice(1).toLowerCase();

    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const existingBuff = activeBuffs.find(b => b.name === 'Resistance');

    const newBuff = {
        name: 'Resistance',
        effect: 'damage_reduction',
        duration,
        resistanceTypes: [damageType],
        sourceCharacter: playerStats.name,
    };

    let newBuffs;
    if (existingBuff) {
        newBuffs = activeBuffs.filter(b => b.name !== 'Resistance');
        newBuffs.push(newBuff);
    } else {
        newBuffs = [...activeBuffs, newBuff];
    }

    setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);
    setRuntimeValue(targetName, RESISTANCE_CHOOSE_KEY, damageType, campaignName);
    setRuntimeValue(targetName, RESISTANCE_USED_KEY, false, campaignName);

    addExpiration(playerStats.name, targetName, [
        { type: 'remove_active_buff', buffName: 'Resistance' }
    ], campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} cast ${action.name} on ${targetName} for ${damageType} resistance (1d4 reduction).`,
        targetName,
        timestamp: Date.now(),
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} applied to ${targetName}. They reduce damage of ${damageType} type by 1d4 (once per turn).`,
            automation: auto,
        },
    };
}

export function getResistanceDamageType(playerName, campaignName) {
    return getRuntimeValue(playerName, RESISTANCE_CHOOSE_KEY, campaignName);
}

export function isResistanceUsedThisTurn(playerName, campaignName) {
    return getRuntimeValue(playerName, RESISTANCE_USED_KEY, campaignName) === true;
}

export function setResistanceUsedThisTurn(playerName, used, campaignName) {
    setRuntimeValue(playerName, RESISTANCE_USED_KEY, used, campaignName);
}
