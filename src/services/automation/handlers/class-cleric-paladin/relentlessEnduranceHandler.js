import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';

const RELENTLESS_ENDURANCE_KEY = 'relentlessEnduranceUsed';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if already used this long rest
    const alreadyUsed = getRuntimeValue(playerName, RELENTLESS_ENDURANCE_KEY, campaignName);
    if (alreadyUsed) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has already been used (once per long rest).`,
                automation: auto,
            },
        };
    }

    const currentHp = getRuntimeValue(playerName, 'currentHitPoints', campaignName) ?? 0;
    if (currentHp > 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${playerName} is not at 0 Hit Points.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, RELENTLESS_ENDURANCE_KEY, true, campaignName);
    await setRuntimeValue(playerName, 'currentHitPoints', 1, campaignName);

    // Reset death saves
    await setRuntimeValue(playerName, 'deathSaves', [false, false, false], campaignName);
    await setRuntimeValue(playerName, 'deathFailures', [false, false, false], campaignName);

    // Remove unconscious condition
    const conditions = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');
    await setRuntimeValue(playerName, 'activeConditions', filtered, campaignName);

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${playerName} uses ${action.name} to survive! Drops to 1 HP instead of 0. Effect is expended until a long rest.`,
            automation: auto,
        },
    };
}

export function isRelentlessEnduranceUsed(playerName, campaignName) {
    return getRuntimeValue(playerName, RELENTLESS_ENDURANCE_KEY, campaignName) === true;
}

export async function setRelentlessEnduranceUsed(playerName, campaignName, used) {
    await setRuntimeValue(playerName, RELENTLESS_ENDURANCE_KEY, used, campaignName);
}
