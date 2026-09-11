import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { GIANT_ANCESTRY_KEY, GIANT_OPTIONS, getOptionByName } from './giantAncestryOptions.js';

export async function confirmGiantAncestry(playerStats, chosenOption, campaignName) {
    await setRuntimeValue(playerStats.name, GIANT_ANCESTRY_KEY, chosenOption, campaignName);

    const option = getOptionByName(chosenOption);
    if (!option) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Giant Ancestry',
                description: 'No option selected.',
                automation: { type: 'resource_pool' },
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Giant Ancestry',
            description: `Selected ${chosenOption}. Uses equal to Proficiency Bonus. Recharges on a Long Rest.`,
            automation: { type: 'resource_pool' },
        },
    };
}

export function getGiantAncestrySelection(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, GIANT_ANCESTRY_KEY, campaignName);
}

export function getGiantAncestryOptions() {
    return GIANT_OPTIONS;
}

export function ancestryInfoPopup(optName, description, automation) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: optName,
            description,
            automation,
        },
    };
}

export function ancestryNoUsesPopup(optName, automation, currentUses) {
    if (currentUses > 0) return null;
    return ancestryInfoPopup(optName, `${optName} has no uses remaining. Uses will reset on the next Long Rest.`, automation);
}

// Shared Frost's Chill trigger gate (dispatch + direct handlers).
// Returns a refusal popup, or null when the trigger is valid.
export function frostsChillAttackerGate(optName, automation, playerStats, lastAttack) {
    if (!lastAttack?.attackEvent) {
        return ancestryInfoPopup(optName, `${optName} requires a recent attack. Use it after hitting a creature.`, automation);
    }
    if (lastAttack.attackerName !== playerStats.name) {
        return ancestryInfoPopup(optName, `${optName} can only be used after you make an attack. Wait for your turn.`, automation);
    }
    if (lastAttack.attackEvent.rollType !== 'attack') {
        return ancestryInfoPopup(optName, `${optName} can only be used after an attack roll.`, automation);
    }
    if (!lastAttack.targetName) {
        return ancestryInfoPopup(optName, `${optName} requires a target. No target found from the last attack.`, automation);
    }
    return null;
}

// Shared Storm's Thunder trigger gate (dispatch + direct handlers).
// Returns a refusal popup, or null when the trigger is valid.
export function stormsThunderTargetGate(optName, automation, playerStats, lastAttack) {
    if (!lastAttack?.attackEvent) {
        return ancestryInfoPopup(optName, `${optName} requires a recent attack where you were the target and took damage.`, automation);
    }
    if (lastAttack.targetName !== playerStats.name) {
        return ancestryInfoPopup(optName, `${optName} can only be used when you were the target of the attack and took damage.`, automation);
    }
    const totalDamage = lastAttack.totalDamage || 0;
    if (totalDamage <= 0) {
        return ancestryInfoPopup(optName, `${optName} requires that you took damage from the attack. No damage was dealt.`, automation);
    }
    if (!lastAttack.attackerName) {
        return ancestryInfoPopup(optName, `${optName} requires a target. No attacker found from the last attack.`, automation);
    }
    return null;
}
