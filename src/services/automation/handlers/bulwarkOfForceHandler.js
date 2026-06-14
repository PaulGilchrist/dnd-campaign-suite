import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../rules/effects/expirations.js';
import { addEntry } from '../../ui/logService.js';

const BULWARK_KEY = 'bulwarkOfForceActive';
const BULWARK_TARGETS_KEY = 'bulwarkOfForceTargets';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0;
    const maxTargets = Math.max(1, intMod);

    // Check if bulwark is already active
    const isActive = getRuntimeValue(playerName, BULWARK_KEY, campaignName);
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

    // Activate the bulwark
    await setRuntimeValue(playerName, BULWARK_KEY, true, campaignName);

    // Initialize empty targets list
    await setRuntimeValue(playerName, BULWARK_TARGETS_KEY, [], campaignName);

    // Set up expiration for 1 round
    addExpiration(playerName, playerName, [
        { type: 'remove_bulwark_of_force' }
    ], campaignName, 1);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Bulwark of Force. Allies within 30 feet have Half Cover.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! Allies within 30 feet have Half Cover until the start of your next turn. Max targets: ${maxTargets}.`,
            automation: auto,
        },
    };
}

export async function handleAddTarget(action, playerStats, targetName, campaignName) {
    const isActive = getRuntimeValue(playerStats.name, BULWARK_KEY, campaignName);
    if (!isActive) {
        return { error: 'Bulwark of Force is not active.' };
    }

    const targets = getRuntimeValue(playerStats.name, BULWARK_TARGETS_KEY, campaignName) || [];
    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0;
    const maxTargets = Math.max(1, intMod);

    if (targets.includes(targetName)) {
        return { error: `${targetName} is already granted Half Cover.` };
    }

    if (targets.length >= maxTargets) {
        return { error: `Maximum targets reached (${maxTargets}).` };
    }

    targets.push(targetName);
    await setRuntimeValue(playerStats.name, BULWARK_TARGETS_KEY, targets, campaignName);

    return { success: true, targetName, targets };
}
