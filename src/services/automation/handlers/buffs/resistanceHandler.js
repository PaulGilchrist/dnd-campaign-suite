import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

const DAMAGE_TYPES = [
    'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
    'Necrotic', 'Piercing', 'Poison', 'Radiant', 'Slashing', 'Thunder'
];

const RESISTANCE_CHOOSE_KEY = 'resistanceChosenDamageType';
const RESISTANCE_USED_KEY = 'resistanceUsedThisTurn';

export async function handle(action, playerStats, campaignName, _mapName) {
    const combatSummary = await getCombatSummary(campaignName);
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
    const damageType = chosenDamageType.charAt(0).toUpperCase() + chosenDamageType.slice(1).toLowerCase();

    registerTargetEffect(campaignName, targetName, 'resistance_damage_reduction', playerStats.name, { chosenType: damageType });
    setRuntimeValue(targetName, RESISTANCE_CHOOSE_KEY, damageType, campaignName);
    setRuntimeValue(targetName, RESISTANCE_USED_KEY, false, campaignName);

    const combatSummary = getCombatSummary(campaignName);
    addConcentration(combatSummary, playerStats.name, 'Resistance', 10);

    addExpiration({ attackerName: playerStats.name, targetName, effects: [
        { type: 'remove_target_effect', effectKey: 'resistance_damage_reduction', source: playerStats.name }
    ], campaignName });

    await addEntry(campaignName, {
        type: 'spell_effect',
        characterName: playerStats.name,
        spellName: action.name,
        targetName,
        effects: [`Resistance (${damageType}): reduces damage of chosen type by 1d4, once per turn`],
        timestamp: Date.now(),
    }).catch((e) => { console.error("[resistanceHandler] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} applied to ${targetName}. They reduce damage of ${damageType} type by 1d4 (once per turn, Concentration).`,
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
