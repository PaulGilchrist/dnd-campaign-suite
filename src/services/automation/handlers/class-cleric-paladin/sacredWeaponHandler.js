import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === action.name);

    if (wasActive) {
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} ended`,
                automation: auto,
            },
        };
    }

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

    await setRuntimeValue(playerName, 'channelDivinityCharges', currentCharges - 1, campaignName);

    const options = auto.options || [];
    if (options.length > 0) {
        return {
            type: 'modal',
            modalName: 'sacredWeaponDamageType',
            payload: {
                action,
                playerStats,
                campaignName,
            },
        };
    }

    return activateSacredWeapon(action, playerStats, campaignName, null);
}

export async function applyDamageTypeChoice(action, playerStats, campaignName, chosenOptionName) {
    return activateSacredWeapon(action, playerStats, campaignName, chosenOptionName);
}

async function activateSacredWeapon(action, playerStats, campaignName, chosenOptionName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const chosen = chosenOptionName
        ? (auto.options || []).find(o => o.name === chosenOptionName)
        : null;

    const buff = {
        name: action.name,
        effect: 'sacred_weapon',
        duration: auto.duration || '10_minutes',
        damageTypeChoice: chosen?.damageType || null,
    };

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = [...activeBuffs, buff];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    const damageTypeText = chosen
        ? ` Damage type set to ${chosen.damageType}.`
        : '';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name} activated. Your melee weapon glows with bright light in a 20-foot radius and dim light for an additional 20 feet. Add your Charisma modifier to attack rolls (minimum +1).${damageTypeText}`,
            automation: auto,
        },
    };
}
