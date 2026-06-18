import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const STONE_SKIN_KEY = 'stoneSkinDamageTypes';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const playerName = playerStats.name;

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
            type: 'stoneSkin_target_selection',
            name: action.name,
            creatureTargets,
            automation: auto,
        },
    };
}

export async function applyStoneSkin(action, playerStats, campaignName, targetName) {
    if (!targetName) {
        return null;
    }

    const auto = action.automation || {};
    const duration = auto.duration || 'Concentration, up to 1 hour';
    const damageTypes = auto.damageTypes || ['Bludgeoning', 'Piercing', 'Slashing'];

    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const existingBuff = activeBuffs.find(b => b.name === action.name);

    const newBuff = {
        name: action.name,
        effect: 'damage_resistance',
        duration,
        resistanceTypes: damageTypes,
        sourceCharacter: playerStats.name,
    };

    let newBuffs;
    if (existingBuff) {
        newBuffs = activeBuffs.filter(b => b.name !== action.name);
        newBuffs.push(newBuff);
    } else {
        newBuffs = [...activeBuffs, newBuff];
    }

    setRuntimeValue(targetName, 'activeBuffs', newBuffs, campaignName);
    setRuntimeValue(targetName, STONE_SKIN_KEY, damageTypes, campaignName);

    addExpiration(playerStats.name, targetName, [
        { type: 'remove_active_buff', buffName: action.name }
    ], campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} cast ${action.name} on ${targetName}. Target has Resistance to Bludgeoning, Piercing, and Slashing damage.`,
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
            description: `${action.name} applied to ${targetName}. They now have Resistance to Bludgeoning, Piercing, and Slashing damage.`,
            automation: auto,
        },
    };
}

export function isStoneSkinActive(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    return activeBuffs.some(b => b.name === 'Stone Skin' && b.effect === 'damage_resistance');
}

export function getStoneSkinDamageTypes(playerName, campaignName) {
    return getRuntimeValue(playerName, STONE_SKIN_KEY, campaignName);
}
