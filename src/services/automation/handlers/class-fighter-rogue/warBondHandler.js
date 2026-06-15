import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const maxBonded = auto.bondedWeaponCount || 2;

    const bondedWeaponsKey = 'warBondWeapons';
    const stored = getRuntimeValue(playerName, bondedWeaponsKey, campaignName);
    const bondedWeapons = Array.isArray(stored) ? stored : [];

    if (bondedWeapons.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `No bonded weapons. Bond a weapon first (up to ${maxBonded}).`,
                automation: auto,
            },
        };
    }

    if (bondedWeapons.length === 1) {
        const weaponName = bondedWeapons[0];
        await setRuntimeValue(playerName, 'warBondSummoned', weaponName, campaignName);
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: ${weaponName} is summoned to your hand.`,
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'warBondSummon',
        payload: { action, playerStats, campaignName, bondedWeapons, maxBonded },
    };
}

export async function handleSummon(action, playerStats, campaignName, selectedWeapon) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (!selectedWeapon) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No weapon selected.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, 'warBondSummoned', selectedWeapon, campaignName);
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${selectedWeapon} is summoned to your hand.`,
            automation: auto,
        },
    };
}
