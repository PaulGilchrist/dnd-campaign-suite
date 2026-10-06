import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';
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

export function applyAncestryDamage({ cs, targetName, damageResult, damageType, campaignName, playerStats }) {
    const characters = cs?.creatures?.filter(c => c.type === 'player') || [];
    const applyResult = applyDamageToTarget(cs, targetName, damageResult?.total ?? 0, [damageType], { campaignName, characters: characters, ignoreResistance: false, attackerName: playerStats.name });
    return { actualDamage: applyResult?.finalDamage ?? damageResult?.total ?? 0, newHp: applyResult?.newHp };
}

export async function logAncestryDamageRoll({ campaignName, playerStats, optName, targetName, damageType, actualDamage, formula, damageResult }) {
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

export function ancestryDamagePopup({ optName, formula, damageResult, actualDamage, targetName, newHp, damageType }) {
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

// CLA-148: RAW duration is "until the START of your next turn" — stamp
// until_start_of_next_turn and arm ONE attacker-anchored clock (fires at the
// attacker's next turn-start, currentRound > appliedRound), mirroring the
// verified FT-082 Hamstring lane (attackRiderHandler.js:612) and the
// hills_tumble anchor seam in this file's consumers.
export async function applySpeedReductionEffect(targetName, sourceName, speedReduction, campaignName, attackerName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredEffects = storedEffects.filter(te => !(te.target === targetName && te.effect === 'speed_reduction'));
    const speedEffect = {
        target: targetName,
        source: sourceName,
        effect: 'speed_reduction',
        value: speedReduction,
        duration: 'until_start_of_next_turn',
    };
    await setRuntimeValue('campaign', 'targetEffects', [...filteredEffects, speedEffect], campaignName);
    addExpiration({
        attackerName,
        targetName,
        effects: [
            { type: 'remove_target_effect', effectKey: 'speed_reduction', source: sourceName, target: targetName },
        ],
        campaignName,
        rounds: undefined,
        expireOnCreatureName: attackerName,
    });
}

export async function logSpeedReductionCondition(campaignName, playerStats, optName, targetName, speedReduction) {
    await addEntry(campaignName, {
        type: 'condition',
        characterName: playerStats.name,
        targetName,
        condition: 'speed_reduction',
        source: optName,
        description: `${playerStats.name} used ${optName} to reduce ${targetName}'s speed by ${speedReduction} ft until the start of ${playerStats.name}'s next turn.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });
}

// CLA-169: Hill's Tumble grant (dispatch + direct handlers). RAW: Disadvantage
// on the target's next attack roll before the end of ITS next turn — stamp the
// registered te with duration until_end_of_next_turn and arm ONE target-anchored
// rounds:2 clock (MA-0038/MA-0073 until_end_of_next_turn shape; the old
// attacker-anchored expireOnCreatureName leg dropped the te at the ATTACKER's
// next turn-start, off the target axis). te disadvantage_next_attack remains the
// one-shot consumed by attackPostProcessing.clearSapDisadvantage on the target's
// next attack roll; the clock is the backstop. Fixes the campaignName-less
// getRuntimeValue('campaign','targetEffects') read (campaign pinned to default).
export function applyHillsTumbleEffect(targetName, playerStats, campaignName) {
    registerTargetEffect(campaignName, targetName, 'disadvantage_next_attack', playerStats.name, {
        duration: 'until_end_of_next_turn',
    });
    addExpiration({
        attackerName: playerStats.name,
        targetName,
        campaignName,
        rounds: 2,
        effects: [{ type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: playerStats.name, target: targetName }],
    });
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
export function stormsThunderRangeRefusal({ campaignName, playerStats, optName, automation, attackerName, rangeFt }) {
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

// CLA-141: no-hit trigger refusals log `<feature>_refused` (zero-spend) with a
// reason token, mirroring the stones_endurance_refused / storms_thunder_refused
// pattern in this file. Shared Fire's Burn / Frost's Chill lane.
function attackerHitRefusal({ campaignName, playerStats, optName, automation, reasonToken, refusalText }) {
    const slug = optName.toLowerCase().replace(/'/g, '').replace(/\s+/g, '_');
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerStats.name,
        automationType: `${slug}_refused`,
        name: optName,
        description: `${optName} refused — ${reasonToken}: ${refusalText}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });
    return ancestryInfoPopup(optName, refusalText, automation);
}

// Shared attacker-trigger gate (Fire's Burn / Frost's Chill, dispatch + direct handlers).
// CLA-141: the trigger is "When you hit a target with an attack roll and deal damage
// to it" — so the last attack must have `hit === true` and have dealt damage
// (canonical machine truth: attackEvent.hit + findLastAttack totalDamage,
// mirroring the verified Psionic Strike CLA-273 gate).
// Returns a refusal popup, or null when the trigger is valid.
export function attackerRollGate(optName, automation, playerStats, lastAttack, campaignName) {
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
    if (lastAttack.attackEvent.hit !== true) {
        return attackerHitRefusal({
            campaignName,
            playerStats,
            optName,
            automation,
            reasonToken: 'attack_missed',
            refusalText: `Your last attack missed ${lastAttack.targetName}. ${optName} triggers only when you hit a target with an attack roll and deal damage to it.`,
        });
    }
    if ((lastAttack.totalDamage || 0) <= 0) {
        return attackerHitRefusal({
            campaignName,
            playerStats,
            optName,
            automation,
            reasonToken: 'no_damage_dealt',
            refusalText: `${optName} requires your attack to deal damage. No damage was dealt to ${lastAttack.targetName}.`,
        });
    }
    return null;
}

// Shared Frost's Chill trigger gate (dispatch + direct handlers).
// Returns a refusal popup, or null when the trigger is valid.
export function frostsChillAttackerGate(optName, automation, playerStats, lastAttack, campaignName) {
    return attackerRollGate(optName, automation, playerStats, lastAttack, campaignName);
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
