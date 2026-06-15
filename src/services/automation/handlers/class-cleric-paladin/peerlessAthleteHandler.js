import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

const PEERLESS_ATHLETE_KEY = 'peerlessAthleteActive';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if already active
    const isActive = getRuntimeValue(playerName, PEERLESS_ATHLETE_KEY, campaignName);
    if (isActive) {
        // Toggle off
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
        await setRuntimeValue(playerName, PEERLESS_ATHLETE_KEY, false, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} ended.`,
                automation: auto,
            },
        };
    }

    // Check Channel Divinity charges
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    const storedCharges = getRuntimeValue(playerName, 'channelDivinityCharges', campaignName);
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

    if (currentCharges <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: 'No Channel Divinity charges remaining.',
                automation: auto,
            },
        };
    }

    // Spend a charge
    await setRuntimeValue(playerName, 'channelDivinityCharges', currentCharges - 1, campaignName);

    // Activate
    await setRuntimeValue(playerName, PEERLESS_ATHLETE_KEY, true, campaignName);

    // Add buff to activeBuffs
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = [...activeBuffs, { name: action.name, effect: 'peerless_athlete', duration: auto.duration || '1_hour' }];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    // Add expiration for 1 hour (6 rounds)
    addExpiration(playerName, playerName, [
        { type: 'peerless_athlete_end' }
    ], campaignName, 6);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Peerless Athlete for 1 hour.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! You have Advantage on Strength (Athletics) and Dexterity (Acrobatics) checks, and Long/High Jump distance +10 feet for 1 hour.`,
            automation: auto,
        },
    };
}
