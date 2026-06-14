import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const HOLY_NIMBUS_KEY = 'holyNimbusActive';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if already active
    const isActive = getRuntimeValue(playerName, HOLY_NIMBUS_KEY, campaignName);
    if (isActive) {
        // Toggle off - remove sunlight_aura buff
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
        await setRuntimeValue(playerName, HOLY_NIMBUS_KEY, false, campaignName);
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
    await setRuntimeValue(playerName, HOLY_NIMBUS_KEY, true, campaignName);

    // Add sunlight_aura buff (aura filled with bright light that is sunlight)
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = activeBuffs.some(b => b.name === action.name)
        ? activeBuffs
        : [...activeBuffs, { name: action.name, effect: 'sunlight_aura', duration: '10_minutes', distance: '10_ft' }];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated Holy Nimbus. Aura of Protection gains holy power for 10 minutes.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated! Aura of Protection is imbued with holy power for 10 minutes.`,
            automation: auto,
        },
    };
}
