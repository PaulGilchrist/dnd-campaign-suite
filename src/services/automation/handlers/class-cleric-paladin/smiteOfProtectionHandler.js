import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

const SMITE_COVER_KEY = 'smiteOfProtectionActive';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if smite cover is already active (prevent stacking)
    const isActive = getRuntimeValue(playerName, SMITE_COVER_KEY, campaignName);
    if (isActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} is already active.`,
                automation: auto,
            },
        };
    }

    // Activate the smite cover buff
    await setRuntimeValue(playerName, SMITE_COVER_KEY, true, campaignName);

    // Set up expiration for start of next turn
    addExpiration(playerName, playerName, [
        { type: 'remove_smite_of_protection' }
    ], campaignName, 1);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Smite of Protection. You and allies in Aura of Protection have Half Cover until start of your next turn.`,
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
            description: `${action.name} activated! You and allies within your Aura of Protection have Half Cover until the start of your next turn.`,
            automation: auto,
        },
    };
}
