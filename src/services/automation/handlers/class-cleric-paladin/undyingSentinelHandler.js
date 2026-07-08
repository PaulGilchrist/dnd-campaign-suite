import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import storage from '../../../ui/storage.js';

const UNDYING_SENTINEL_KEY = 'undyingSentinelUsed';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if already used this long rest
    const alreadyUsed = getRuntimeValue(playerName, UNDYING_SENTINEL_KEY, campaignName);
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

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat active.',
                automation: auto,
            },
        };
    }

    const target = getTargetFromAttacker(cs, playerName);
    if (!target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Select a target in the combat tracker first.',
                automation: auto,
            },
        };
    }

    const targetHp = target.type === 'player'
        ? (getRuntimeValue(target.name, 'currentHitPoints', campaignName) ?? 0)
        : (target.currentHp ?? 0);

    if (targetHp > 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${target.name} is not at 0 Hit Points.`,
                automation: auto,
            },
        };
    }

    const paladinLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.level || playerStats.level;
    const healAmount = paladinLevel * 3;
    const newHp = Math.min(1 + healAmount, getRuntimeValue(playerName, 'hitPoints', campaignName) ?? 100);

    await setRuntimeValue(playerName, UNDYING_SENTINEL_KEY, true, campaignName);

    if (target.type === 'player') {
        await setRuntimeValue(target.name, 'currentHitPoints', newHp, campaignName);
    } else {
        target.currentHp = newHp;
        if (cs) {
            storage.set('combatSummary', cs, campaignName);
        }
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    addEntry(campaignName, {
        type: 'heal',
        characterName: playerName,
        targetName: target.name,
        amount: newHp,
        abilityName: action.name,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[undyingSentinel] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${playerName} uses ${action.name} to survive! ${target.name} drops to ${newHp} HP and the effect is expended until a long rest.`,
            automation: auto,
        },
    };
}

export function isUndyingSentinelUsed(playerName, campaignName) {
    return getRuntimeValue(playerName, UNDYING_SENTINEL_KEY, campaignName) === true;
}

export async function setUndyingSentinelUsed(playerName, campaignName, used) {
    await setRuntimeValue(playerName, UNDYING_SENTINEL_KEY, used, campaignName);
}
