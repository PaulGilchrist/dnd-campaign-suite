import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { getRuntimeUsesKey, GIANT_ANCESTRY_KEY, GIANT_OPTIONS, getOptionByName } from './giantAncestryOptions.js';

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

export function resolveAncestryUses(playerStats, optName, campaignName) {
    const usesKey = getRuntimeUsesKey(optName);
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);
    return { usesKey, currentUses };
}

export function applyAncestryDamage(cs, targetName, damageResult, damageType, campaignName, playerStats) {
    const characters = cs?.creatures?.filter(c => c.type === 'player') || [];
    const applyResult = applyDamageToTarget(cs, targetName, damageResult?.total ?? 0, [damageType], campaignName, characters, { ignoreResistance: false, attackerName: playerStats.name });
    return { actualDamage: applyResult?.finalDamage ?? damageResult?.total ?? 0, newHp: applyResult?.newHp };
}

export async function logAncestryDamageRoll(campaignName, playerStats, optName, targetName, damageType, actualDamage, formula, damageResult) {
    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'damage',
        name: optName + ' Damage',
        targetName,
        damageType,
        total: actualDamage,
        formula,
        rolls: damageResult?.rolls,
        description: `${playerStats.name} used ${optName} to deal ${actualDamage} ${damageType} damage to ${targetName}.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });
}

export function ancestryDamagePopup(optName, formula, damageResult, actualDamage, targetName, newHp, damageType) {
    return {
        type: 'popup',
        payload: {
            type: 'damage',
            name: optName,
            formula,
            rolls: damageResult?.rolls,
            total: actualDamage,
            finalDamage: actualDamage,
            damageApplied: true,
            targetName,
            targetCurrentHp: newHp,
            damageType,
        },
    };
}

export async function applySpeedReductionEffect(targetName, sourceName, speedReduction, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredEffects = storedEffects.filter(te => !(te.target === targetName && te.effect === 'speed_reduction'));
    const speedEffect = {
        target: targetName,
        source: sourceName,
        effect: 'speed_reduction',
        value: speedReduction,
        duration: 'until_end_of_next_turn',
    };
    await setRuntimeValue('campaign', 'targetEffects', [...filteredEffects, speedEffect], campaignName);
}

export async function logSpeedReductionCondition(campaignName, playerStats, optName, targetName, speedReduction) {
    await addEntry(campaignName, {
        type: 'condition',
        characterName: playerStats.name,
        targetName,
        condition: 'speed_reduction',
        source: optName,
        description: `${playerStats.name} used ${optName} to reduce ${targetName}'s speed by ${speedReduction} ft until the end of their next turn.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });
}

// Shared Stone's Endurance trigger gate (dispatch handler).
// Returns a refusal popup, or null when the trigger is valid.
export function stonesEnduranceDamageGate(optName, automation, playerStats, lastAttack) {
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
    return null;
}

// CLA-335: Reaction-economy round latch refusal for Stone's Endurance.
// Logs the refusal and returns the refusal popup.
export function stonesEnduranceRoundRefusal(campaignName, playerStats, optName, automation) {
    const refusalText = `You have already used ${optName} this round — your Reaction is spent until your next turn.`;
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerStats.name,
        automationType: 'stones_endurance_refused',
        name: optName,
        description: refusalText,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });
    return ancestryInfoPopup(optName, refusalText, automation);
}

export function stonesEnduranceCapNote(totalHeal, rawHeal, finalHeal) {
    if (totalHeal > rawHeal) return `capped at ${rawHeal} (damage taken)`;
    if (finalHeal < rawHeal) return `capped at ${finalHeal} (HP deficit)`;
    return '';
}

// Shared Storm's Thunder range-gate refusal (dispatch + direct handlers).
export function stormsThunderRangeRefusal(campaignName, playerStats, optName, automation, attackerName, rangeFt) {
    const refusalText = `${optName} requires the attacker to be within ${rangeFt} feet of you. ${attackerName} is out of range.`;
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerStats.name,
        automationType: 'storms_thunder_refused',
        name: optName,
        description: refusalText,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });
    return ancestryInfoPopup(optName, refusalText, automation);
}

// Shared attacker-trigger gate (Fire's Burn / Frost's Chill, dispatch + direct handlers).
// Returns a refusal popup, or null when the trigger is valid.
export function attackerRollGate(optName, automation, playerStats, lastAttack) {
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

// Shared Frost's Chill trigger gate (dispatch + direct handlers).
// Returns a refusal popup, or null when the trigger is valid.
export function frostsChillAttackerGate(optName, automation, playerStats, lastAttack) {
    return attackerRollGate(optName, automation, playerStats, lastAttack);
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
