import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCurrentCombatRound as getCombatRoundFromCache } from '../../../../services/encounters/combatData.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const options = auto.options || [];

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} enabled — next Unarmed Strike damage type will be chosen`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    if (options.length > 0) {
        return {
            type: 'modal',
            modalName: 'damageTypeModifier',
            payload: {
                action,
                playerStats,
                campaignName,
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} ready. The next eligible Unarmed Strike will use your chosen damage type.`,
            automation: auto,
        },
    };
}

export async function applyDamageTypeChoice(action, playerStats, campaignName, chosenOptionName) {
    const auto = action.automation;
    const options = auto.options || [];
    const chosen = options.find(o => o.name === chosenOptionName);

    if (!chosen) return null;

    const usedKey = `_${action.name.replace(/\s+/g, '_')}_usedRound`;

    // Store the chosen damage type for the current round
    setRuntimeValue(playerStats.name, 'empoweredStrikesDamageType', chosen.damageType, campaignName);
    setRuntimeValue(playerStats.name, usedKey, getCombatRoundFromCache(), campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} — damage type set to ${chosen.damageType}`,
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
            description: `Damage type set to ${chosen.damageType} for your next Unarmed Strike.`,
            automation: auto,
        },
    };
}
