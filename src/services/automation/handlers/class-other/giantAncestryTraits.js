import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeUsesKey } from './giantAncestryOptions.js';
import { ancestryNoUsesPopup, frostsChillAttackerGate, stormsThunderTargetGate, attackerRollGate, resolveAncestryUses, applyAncestryDamage, ancestryDamagePopup, applySpeedReductionEffect, logSpeedReductionCondition, stormsThunderRangeRefusal, stonesEnduranceDamageGate, stonesEnduranceRoundRefusal, stonesEnduranceCapNote } from './giantAncestryUtils.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

export async function handleCloudsJauntDirect(action, playerStats, campaignName) {
    const usesKey = getRuntimeUsesKey("Cloud's Jaunt");
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Cloud's Jaunt",
                description: "Cloud's Jaunt has no uses remaining. Uses will reset on the next Long Rest.",
                automation: action.automation,
            },
        };
    }

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: "Cloud's Jaunt",
        description: `${playerStats.name} used Cloud's Jaunt to teleport up to 30 feet to an unoccupied space they can see.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: "Cloud's Jaunt",
            automationType: 'teleport',
            description: `Cloud's Jaunt: Teleported up to 30 feet to an unoccupied space they can see.`,
            automation: action.automation,
        },
    };
}

export async function handleFiresBurnDirect(action, playerStats, campaignName) {
    const optName = "Fire's Burn";
    const { usesKey, currentUses } = resolveAncestryUses(playerStats, optName, campaignName);

    if (currentUses <= 0) return ancestryNoUsesPopup(optName, action.automation, currentUses);

    const lastAttack = await findLastAttack(campaignName);
    const gateRefusal = attackerRollGate(optName, action.automation, playerStats, lastAttack);
    if (gateRefusal) return gateRefusal;

    const targetName = lastAttack.targetName;

    const formula = action.automation.damage || '1d10';
    const damageResult = rollExpression(formula);
    const damageType = action.automation.damageType || 'Fire';

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const cs = await getCombatContext(campaignName);
    const { actualDamage, newHp } = applyAncestryDamage(cs, targetName, damageResult, damageType, campaignName, playerStats);

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
        description: `${playerStats.name} used ${optName} to deal ${actualDamage} fire damage to ${targetName}.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return ancestryDamagePopup({ optName, formula, damageResult, actualDamage, targetName, newHp, damageType });
}

export async function handleFrostsChillDirect(action, playerStats, campaignName) {
    const optName = "Frost's Chill";
    const { usesKey, currentUses } = resolveAncestryUses(playerStats, optName, campaignName);

    const noUses = ancestryNoUsesPopup(optName, action.automation, currentUses);
    if (noUses) return noUses;

    const lastAttack = await findLastAttack(campaignName);
    const gateRefusal = frostsChillAttackerGate(optName, action.automation, playerStats, lastAttack);
    if (gateRefusal) return gateRefusal;

    const targetName = lastAttack.targetName;

    const formula = action.automation.damage || '1d6';
    const damageResult = rollExpression(formula);
    const damageType = action.automation.damageType || 'Cold';
    const speedReduction = parseInt((action.automation.value || '').replace('_ft', ''), 10) || 10;

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const cs = await getCombatContext(campaignName);
    const { actualDamage, newHp } = applyAncestryDamage(cs, targetName, damageResult, damageType, campaignName, playerStats);

    await applySpeedReductionEffect(targetName, optName, speedReduction, campaignName);

    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'damage',
        name: "Frost's Chill" + ' Damage',
        targetName,
        damageType,
        total: actualDamage,
        formula,
        rolls: damageResult?.rolls,
        description: `${playerStats.name} used Frost's Chill to deal ${actualDamage} cold damage to ${targetName}.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    await logSpeedReductionCondition(campaignName, playerStats, optName, targetName, speedReduction);

    return ancestryDamagePopup({ optName, formula, damageResult, actualDamage, targetName, newHp, damageType });
}

export async function handleHillsTumbleDirect(action, playerStats, campaignName) {
    const optName = "Hill's Tumble";
    const usesKey = getRuntimeUsesKey(optName);
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: optName,
                description: `${optName} has no uses remaining. Uses will reset on the next Long Rest.`,
                automation: action.automation,
            },
        };
    }

    const lastAttack = await findLastAttack(campaignName);
    if (!lastAttack?.attackEvent) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: optName,
                description: `${optName} requires a recent attack. Use it after hitting a creature.`,
                automation: action.automation,
            },
        };
    }

    if (lastAttack.attackerName !== playerStats.name) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: optName,
                description: `${optName} can only be used after you make an attack. Wait for your turn.`,
                automation: action.automation,
            },
        };
    }

    if (lastAttack.attackEvent.rollType !== 'attack') {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: optName,
                description: `${optName} can only be used after an attack roll.`,
                automation: action.automation,
            },
        };
    }

    const targetName = lastAttack.targetName;
    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: optName,
                description: `${optName} requires a target. No target found from the last attack.`,
                automation: action.automation,
            },
        };
    }

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const allTargetEffects = [...getRuntimeValue('campaign', 'targetEffects') || []];
    const existingIndex = allTargetEffects.findIndex(
        te => te.target === targetName && te.effect === 'disadvantage_next_attack' && te.source === playerStats.name
    );

    const tumbleEffect = {
        target: targetName,
        source: playerStats.name,
        effect: 'disadvantage_next_attack',
    };

    if (existingIndex >= 0) {
        allTargetEffects[existingIndex] = tumbleEffect;
    } else {
        allTargetEffects.push(tumbleEffect);
    }

    setRuntimeValue('campaign', 'targetEffects', allTargetEffects, campaignName);

    addExpiration(playerStats.name, targetName, [
        { type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: playerStats.name },
    ], campaignName, undefined, playerStats.name);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: optName,
        description: `${playerStats.name} used ${optName} to give ${targetName} Disadvantage on their next attack roll.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    await addEntry(campaignName, {
        type: 'condition',
        characterName: playerStats.name,
        targetName,
        condition: 'Disadvantage on next attack',
        source: optName,
        description: `${playerStats.name} used ${optName} to apply Disadvantage on the next attack roll to ${targetName} until the end of their next turn.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: optName,
            automationType: 'hills_tumble',
            description: `${optName}: <strong>${targetName}</strong> has Disadvantage on its next attack roll until the end of its next turn.`,
            automation: action.automation,
        },
    };
}

export async function handleStonesEnduranceDirect(action, playerStats, campaignName) {
    const optName = "Stone's Endurance";
    const { usesKey, currentUses } = resolveAncestryUses(playerStats, optName, campaignName);

    const noUses = ancestryNoUsesPopup(optName, action.automation, currentUses);
    if (noUses) return noUses;

    const lastAttack = await findLastAttack(campaignName);
    const gateRefusal = stonesEnduranceDamageGate(optName, action.automation, playerStats, lastAttack);
    if (gateRefusal) return gateRefusal;

    const totalDamage = lastAttack.totalDamage || 0;

    // CLA-335: Reaction-economy round latch — one triggering hit can only be
    // reduced once. Mirrors the CLA-315 Slow Fall / CLA-297 Retaliation /
    // CLA-310 Shadowy Dodge recipe: stamp holder playerStats.name with a round
    // read from a FRESH getCombatContext (never the stale cs mirror, FT-082);
    // re-arms when the round advances (also cleared at initiative roll in
    // initiative.jsx / navigationHandlers.js).
    const combatContext = await getCombatContext(campaignName);
    const currentRound = combatContext?.round || 1;
    const usedRoundKey = '_Stones_Endurance_usedRound';
    const usedRound = Number(getRuntimeValue(playerStats.name, usedRoundKey, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return stonesEnduranceRoundRefusal(campaignName, playerStats, optName, action.automation);
    }

    const enduranceRoll = rollExpression('1d12');
    const conMod = playerStats.abilities?.find(a => a.name === 'Constitution')?.bonus || 0;
    const totalHeal = enduranceRoll.total + conMod;
    const rawHeal = Math.min(totalHeal, totalDamage);

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
    await setRuntimeValue(playerStats.name, usedRoundKey, currentRound, campaignName);

    const cs = await getCombatContext(campaignName);
    const healResult = applyHealingToTarget(cs, playerStats.name, rawHeal, campaignName);
    const finalHeal = healResult?.actualHeal ?? rawHeal;

    const capNote = stonesEnduranceCapNote(totalHeal, rawHeal, finalHeal);
    const capText = capNote ? `, ${capNote}` : '';

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: optName,
        description: `${playerStats.name} used ${optName} to heal ${finalHeal} HP (rolled ${enduranceRoll.total} + ${conMod} CON modifier = ${totalHeal}${capText}).`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    await addEntry(campaignName, {
        type: 'healing',
        characterName: playerStats.name,
        targetName: playerStats.name,
        amount: finalHeal,
        source: optName,
        description: `${playerStats.name} used ${optName} to heal ${finalHeal} HP.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: optName,
            automationType: 'stones_endurance',
            description: `${optName}: Rolled <strong>${enduranceRoll.total}</strong> + ${conMod} CON = <strong>${totalHeal}</strong>${capText ? ` (${capNote})` : ''}. Healed <strong>${finalHeal}</strong> HP.`,
            automation: action.automation,
        },
    };
}

export async function handleStormsThunderDirect(action, playerStats, campaignName, _mapName) {
    const optName = "Storm's Thunder";
    const { usesKey, currentUses } = resolveAncestryUses(playerStats, optName, campaignName);

    const noUses = ancestryNoUsesPopup(optName, action.automation, currentUses);
    if (noUses) return noUses;

    const lastAttack = await findLastAttack(campaignName);
    const gateRefusal = stormsThunderTargetGate(optName, action.automation, playerStats, lastAttack);
    if (gateRefusal) return gateRefusal;

    const attackerName = lastAttack.attackerName;

    // CLA-337: 60-ft trigger gate — the attacker must be within the trait's
    // range. Canonical isWithinRange helper (rangeCheck.js): strict token
    // distances on a mapped rig, lenient true when gridless/unpositioned.
    const rangeFt = rangeToFeet(action.automation.range) ?? 60;
    const inRange = await isWithinRange(attackerName, playerStats.name, rangeFt);
    if (!inRange) {
        return stormsThunderRangeRefusal(campaignName, playerStats, optName, action.automation, attackerName, rangeFt);
    }

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const formula = action.automation.damage || '1d8';
    const damageResult = rollExpression(formula);
    const damageType = action.automation.damageType || 'Thunder';

    const cs = await getCombatContext(campaignName);
    const { actualDamage, newHp } = applyAncestryDamage(cs, attackerName, damageResult, damageType, campaignName, playerStats);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: optName,
        description: `${playerStats.name} used ${optName} against ${attackerName} (${currentUses - 1} uses remaining), dealing ${actualDamage} ${damageType} damage.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'damage',
        name: optName + ' Damage',
        targetName: attackerName,
        damageType,
        total: actualDamage,
        formula,
        rolls: damageResult?.rolls,
        description: `${playerStats.name} used ${optName} to deal ${actualDamage} thunder damage to ${attackerName}.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return ancestryDamagePopup({ optName, formula, damageResult, actualDamage, targetName: attackerName, newHp, damageType });
}
