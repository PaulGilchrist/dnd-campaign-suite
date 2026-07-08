import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';


const LAST_STAND_KEY = 'boonOfRecoveryLastStandUsed';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const lastStandUsed = getRuntimeValue(playerName, LAST_STAND_KEY, campaignName);

    if (lastStandUsed) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: Last Stand has already been used. Recharges after a Long Rest.`,
                automation: auto,
            },
        };
    }

    const maxHp = playerStats.hitPoints?.max || playerStats.barbarianLevel || playerStats.level || 1;
    const healAmount = Math.floor(maxHp / 2);
    const newHp = Math.max(1, healAmount);

    await setRuntimeValue(playerName, LAST_STAND_KEY, true, campaignName);
    await setRuntimeValue(playerName, 'currentHitPoints', newHp, campaignName);

    const conditions = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');
    await setRuntimeValue(playerName, 'activeConditions', filtered, campaignName);

    await setRuntimeValue(playerName, 'deathSaves', [false, false, false], campaignName);
    await setRuntimeValue(playerName, 'deathFailures', [false, false, false], campaignName);

    addEntry(campaignName, {
        type: 'heal',
        targetName: playerName,
        delta: newHp,
        currentHp: newHp,
        maxHp,
        isHealing: true,
        isUnconscious: false,
        abilityName: action.name,
    }).catch((e) => { console.error("[boonOfRecovery] Error:", e); });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} (Last Stand) to drop to ${newHp} HP instead of 0.`,
    }).catch((e) => { console.error("[boonOfRecovery] Error:", e); });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${playerName} uses Last Stand to drop to ${newHp} HP instead of 0, regaining ${healAmount} hit points.`,
            automation: auto,
        },
    };
}

export function isLastStandAvailable(playerStats, campaignName) {
    const playerName = playerStats.name;
    const lastStandUsed = getRuntimeValue(playerName, LAST_STAND_KEY, campaignName);
    return !lastStandUsed;
}

export function getLastStandUsed(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, LAST_STAND_KEY, campaignName);
}
