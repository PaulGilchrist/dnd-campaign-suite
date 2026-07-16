import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const maxUses = auto.uses_expression
        ? evaluateAutoExpression(auto.uses_expression, playerStats)
        : 0;

    if (maxUses > 0) {
        const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
        const currentUses = Number(getRuntimeValue(playerName, usesKey) ?? maxUses);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has been used and cannot be used again until a short or long rest.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    }

    const rangeFt = rangeToFeet(auto.range || '30 ft');
    const allies = [];

    if (mapName && rangeFt != null) {
        const mapPlayers = (await loadMapData(campaignName))?.players || [];
        for (const p of mapPlayers) {
            if (p.name === playerName) continue;
            const inRange = await isWithinRange(playerName, p.name, rangeFt);
            if (inRange) {
                allies.push(p.name);
            }
        }
    } else if (!mapName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: Could not resolve allies without a map.`,
                automation: auto,
            },
        };
    }

    for (const targetName of allies) {
        const existing = getRuntimeValue(targetName, 'hasInspiration') || false;
        if (!existing) {
            await setRuntimeValue(targetName, 'hasInspiration', true, campaignName);
        }
    }

    const targetList = allies.length > 0 ? allies.join(', ') : 'no targets in range';
    const description = `${action.name}: Granted Heroic Inspiration to ${allies.length} ally${allies.length !== 1 ? 'ies' : 'y'} (${targetList}).`;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to grant Heroic Inspiration to ${allies.length} ally${allies.length !== 1 ? 'ies' : 'y'}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[encouragingSongHandler] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description,
            automation: auto,
        },
    };
}
