import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const LARGE_FORM_KEY = 'largeFormActive';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check level 5 gate
    if (playerStats.level < 5) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: 'Large Form requires character level 5.',
                automation: auto,
            },
        };
    }

    // Check if already active
    const isActive = getRuntimeValue(playerName, LARGE_FORM_KEY, campaignName);
    if (isActive) {
        // Toggle off
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
        await setRuntimeValue(playerName, LARGE_FORM_KEY, false, campaignName);
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

    // Check long rest
    const alreadyUsed = getRuntimeValue(playerName, LARGE_FORM_KEY + '_restUsed', campaignName);
    if (alreadyUsed) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: 'Large Form has been used and cannot be used again until a Long Rest.',
                automation: auto,
            },
        };
    }

    // Activate
    await setRuntimeValue(playerName, LARGE_FORM_KEY, true, campaignName);

    // Add buff to activeBuffs
    const storedBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffList = Array.isArray(storedBuffs) ? storedBuffs : [];
    const buffEntry = {
        name: action.name,
        effect: 'large_form',
        duration: auto.duration || '10_minutes',
        hasAutomation: true,
    };
    const newBuffs = activeBuffList.some(b => b.name === action.name)
        ? activeBuffList
        : [...activeBuffList, buffEntry];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Large Form for 10 minutes.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! Size changes to Large, Speed increases by 10 feet, Advantage on Strength checks for 10 minutes.`,
            automation: auto,
        },
    };
}

export function isLargeFormActive(playerName, campaignName) {
    return getRuntimeValue(playerName, LARGE_FORM_KEY, campaignName) === true;
}
