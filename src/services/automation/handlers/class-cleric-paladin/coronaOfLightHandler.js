import { toggleBuff } from '../../common/buffToggle.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

const CORONA_ENEMIES_KEY = 'coronaOfLightEnemies';

export async function activateCoronaOfLight(action, playerStats, campaignName, selectedEnemies) {
    const auto = action.automation;
    const playerName = playerStats.name;

    toggleBuff(
        playerName,
        action.name,
        auto,
        campaignName,
        playerName
    );

    // Store selected enemies list on the caster's character key
    await setRuntimeValue(playerName, CORONA_ENEMIES_KEY, selectedEnemies, campaignName);

    // Set up expiration for 1 minute (10 rounds)
    addExpiration(playerName, playerName, [
        { type: 'remove_active_buff', buffName: action.name }
    ], campaignName, 10);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Corona of Light. Enemies: ${selectedEnemies.join(', ') || 'none selected (all enemies affected)'}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[coronaOfLight] Error:', e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! Enemies with disadvantage on saves vs Fire/Radiant: ${selectedEnemies.join(', ') || 'all other creatures'}.`,
            automation: auto,
        },
    };
}

export function removeCoronaEnemies(playerName, campaignName) {
    setRuntimeValue(playerName, CORONA_ENEMIES_KEY, null, campaignName);
}
