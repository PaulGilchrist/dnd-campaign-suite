import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { applyDamageToTarget, computeDamageAfterSave } from '../../../rules/combat/applyDamage.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { createSaveListener } from '../../common/savePrompt.js';

function hasShield(playerStats) {
    const equipped = playerStats.inventory?.equipped || [];
    for (const itemName of equipped) {
        if (!itemName || typeof itemName !== 'string') continue;
        const { baseName } = parseMagicItemName(itemName);
        const item = playerStats.equipment?.find(e => e.name === baseName);
        if (item) {
            if (item.armor_category === 'Shield') return true;
        }
    }
    return false;
}

function hasShieldOrWeapon(playerStats) {
    const equipped = playerStats.inventory?.equipped || [];
    for (const itemName of equipped) {
        if (!itemName || typeof itemName !== 'string') continue;
        const { baseName } = parseMagicItemName(itemName);
        const item = playerStats.equipment?.find(e => e.name === baseName);
        if (item) {
            if (item.armor_category === 'Shield') return true;
            if (item.equipment_category === 'Weapon') return true;
        }
    }
    return false;
}

function parseMagicItemName(itemName) {
    if (itemName && typeof itemName === 'string' && itemName.charAt(0) === '+') {
        const magicBonus = Number(itemName.charAt(1));
        return {
            baseName: itemName.substring(3),
            magicBonus: isNaN(magicBonus) ? 0 : magicBonus,
        };
    }
    return { baseName: itemName, magicBonus: 0 };
}

function getMonkLevel(playerStats) {
    if (!playerStats.class?.class_levels) return 0;
    const monkLevel = playerStats.class.class_levels.find(cl => cl.class === 'Monk' || cl.name === 'Monk');
    return monkLevel?.level || 0;
}

function getMartialArtsDie(playerStats) {
    return playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.martial_arts_die || 4;
}

function matchesTrigger(lastAttack, trigger) {
    if (!trigger) return true;

    if (trigger === 'bludgeoning_piercing_slashing_damage') {
        const types = lastAttack.damageTypes || [];
        return types.some(t =>
            t.toLowerCase() === 'bludgeoning' ||
            t.toLowerCase() === 'piercing' ||
            t.toLowerCase() === 'slashing'
        );
    }

    if (trigger === 'any_damage') {
        const types = lastAttack.damageTypes || [];
        return types.length > 0 || lastAttack.totalDamage > 0;
    }

    if (trigger === 'ranged_weapon_attack_hit') {
        return lastAttack.attackEvent?.weaponType === 'ranged';
    }

    return true;
}

function rollReductionExpression(expression, playerStats) {
    if (!expression) return { total: 0, rolls: [], display: '0' };

    const evaluated = evaluateAutoExpression(expression, playerStats);

    if (typeof evaluated === 'number') {
        return { total: evaluated, rolls: [], display: `${expression} = ${evaluated}` };
    }

    const roll = rollExpression(evaluated);

    if (roll && roll.total !== undefined) {
        return { total: roll.total, rolls: roll.rolls, display: `${expression} = ${roll.total}` };
    }

    return { total: 0, rolls: [], display: '0' };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Deflect Attacks';

    if (auto.requiresShield && !hasShield(playerStats)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: You must be holding a Shield to use this Reaction.`,
                automation: auto,
            },
        };
    }

    if (auto.requiresShieldOrWeapon && !hasShieldOrWeapon(playerStats)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: You must be holding a Shield or a Simple or Martial weapon to use this Reaction.`,
                automation: auto,
            },
        };
    }

    if (auto.effect === 'zero_on_success_half_on_fail') {
        return handleZeroOnSuccessHalfOnFail(action, playerStats, campaignName);
    }

    const lastAttack = await findLastAttack(campaignName);

    if (!lastAttack.attackEvent) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent attack found. ${featureName} can only be used after taking damage in combat.`,
                automation: auto,
            },
        };
    }

    if (lastAttack.targetName !== playerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `The last attack did not target you. ${featureName} can only be used when you are the target.`,
                automation: auto,
            },
        };
    }

    if (!matchesTrigger(lastAttack, auto.trigger)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: The last attack's damage type does not match the trigger condition (${auto.trigger}).`,
                automation: auto,
            },
        };
    }

    const totalDamage = lastAttack.totalDamage || 0;
    const primaryDamage = lastAttack.primaryDamage || 0;
    const secondaryDamage = lastAttack.secondaryDamage || 0;

    const reductionRoll = rollReductionExpression(auto.reductionExpression, playerStats);
    const reductionAmount = reductionRoll.total;
    const actualHeal = Math.min(reductionAmount, totalDamage);
    const damageAfterReduction = Math.max(0, totalDamage - reductionAmount);

    const cs = await getCombatContext(campaignName);
    let healedAmount = 0;
    if (cs && actualHeal > 0) {
        const healResult = await applyHealingToTarget(cs, playerName, actualHeal, campaignName);
        healedAmount = healResult?.actualHeal ?? 0;
    }

    if (healedAmount > 0) {
        const currentHp = getRuntimeValue(playerName, 'currentHitPoints', campaignName) ?? playerStats.computedStats?.currentHp ?? 0;
        const maxHp = getRuntimeValue(playerName, 'hitPoints', campaignName) ?? playerStats.computedStats?.maxHp ?? 0;
        await addEntry(campaignName, {
            type: 'hp_change',
            targetName: playerName,
            delta: healedAmount,
            currentHp,
            maxHp,
            isHealing: true,
            sourceName: featureName,
            note: `${reductionRoll.display} HP from ${totalDamage} damage reduced by ${featureName}`,
        }).catch((e) => { console.error("[damageReduction] Error logging heal:", e); });
    }

    const attackEvent = lastAttack.attackEvent;
    const attackDetailsHTML = attackEvent ? `
        <br/><br/><b>Last Attack:</b> ${attackEvent.attackerName || 'Unknown'} → ${playerName}<br/>
        <b>Original damage:</b> ${totalDamage} (${primaryDamage} primary + ${secondaryDamage} secondary)<br/>
        <b>Damage types:</b> ${(lastAttack.damageTypes || []).join(', ') || 'None'}<br/>
        <b>Deflect roll:</b> ${reductionRoll.display}<br/>
        <b>Damage reduced to:</b> <strong>${damageAfterReduction}</strong><br/>
        ${healedAmount > 0 ? `<b>Healed:</b> ${healedAmount} HP` : '<b>Healed:</b> 0 HP (already at max or no damage to reduce)'}
    ` : '';

    if (damageAfterReduction === 0 && auto.redirect) {
        const popupResult = {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `<b>${featureName}</b>: Damage reduced to 0!${attackDetailsHTML}`,
                automation: auto,
            },
        };

        const redirectResult = await handleRedirect(action, auto, playerStats, campaignName, featureName);
        if (redirectResult) {
            return redirectResult;
        }
        return popupResult;
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} to reduce damage by ${reductionRoll.display} (${healedAmount > 0 ? `healed for ${healedAmount} HP` : 'no healing needed'}).`,
    }).catch((e) => { console.error("[damageReduction] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `<b>${featureName}</b>: Reduce damage by <strong>${reductionRoll.display}</strong>.${auto.trigger ? ` Trigger: ${auto.trigger}.` : ''}${attackDetailsHTML}`,
            automation: auto,
        },
    };
}

async function handleRedirect(action, auto, playerStats, campaignName, featureName) {
    const playerName = playerStats.name;

    const cost = auto.redirectCost?.amount || 1;
    const resource = auto.redirectCost?.resource || 'focus_points';
    const maxResource = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points || 0;
    const currentResource = Number(getRuntimeValue(playerName, resource, campaignName) ?? maxResource);

    if (currentResource < cost) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: You need ${cost} ${resource.replace('_', ' ')} to redirect force. You only have ${currentResource}.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, resource, currentResource - cost, campaignName);

    const cs = await getCombatContext(campaignName);
    if (!cs || !cs.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No creatures available to redirect force to.`,
                automation: auto,
            },
        };
    }

    const targets = cs.creatures.map(c => {
        const hp = c.type === 'player'
            ? { currentHp: getRuntimeValue(c.name, 'currentHitPoints') ?? getRuntimeValue(c.name, 'hitPoints') ?? 0, maxHp: getRuntimeValue(c.name, 'hitPoints') ?? 0 }
            : { currentHp: c.currentHp ?? c.maxHp, maxHp: c.maxHp };
        return { ...c, ...hp };
    });

    const martialArtsDie = getMartialArtsDie(playerStats);
    const redirectDamageExpression = auto.redirectDamage || `2 * ${martialArtsDie} + DEX modifier`;

    const calculatedSaveDc = 8 + (playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus || 0) + getMonkLevel(playerStats) + (playerStats.proficiency || 0);
    const finalSaveDc = auto.saveDc || calculatedSaveDc;

    return {
        type: 'modal',
        modalName: 'deflectRedirect',
        payload: {
            title: `${featureName} — Redirect Force`,
            targets,
            confirmLabel: 'Redirect Force',
            confirmIcon: 'fa-bolt',
            featureDescription: `Target makes a DEX saving throw (DC ${finalSaveDc}) or takes 2 × ${martialArtsDie}-sided die + Dexterity modifier Force damage.`,
            description: `You reduced the damage to 0. You expend 1 ${resource.replace('_', ' ')} to redirect the force to a creature.`,
            onTargetSelected: async (targetName) => {
                await executeRedirect(playerName, targetName, campaignName, auto, redirectDamageExpression, featureName, playerStats, finalSaveDc);
            },
            onSkip: async () => {
                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: featureName,
                    description: `${playerName} used ${featureName} to reduce damage to 0 but chose not to redirect force.`,
                }).catch((e) => { console.error("[damageReduction] Skip redirect:", e); });
            },
        },
    };
}

async function executeRedirect(playerName, targetName, campaignName, auto, redirectDamageExpression, featureName, playerStats, finalSaveDc) {
    if (!targetName) return;

    const cs = await getCombatContext(campaignName);
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];

    const evaluated = evaluateAutoExpression(redirectDamageExpression, playerStats);

    let redirectDamage = 0;
    let rollDisplay = '';

    if (typeof evaluated === 'number') {
        redirectDamage = evaluated;
        rollDisplay = `${redirectDamageExpression} = ${evaluated}`;
    } else {
        const roll = rollExpression(evaluated);
        if (roll && roll.total !== undefined) {
            redirectDamage = roll.total;
            rollDisplay = `${redirectDamageExpression} = ${roll.total}`;
        } else {
            redirectDamage = 0;
        }
    }

    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'DEX',
        saveDc: finalSaveDc,
        actionName: featureName,
    });

    const saveResult = await promise;

    const damageOnSave = computeDamageAfterSave(redirectDamage, saveResult.success, null);

    if (damageOnSave > 0 && cs) {
        await applyDamageToTarget(cs, targetName, damageOnSave, ['Force'], campaignName, characters, false, playerName);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} redirected force to ${targetName}. ${targetName} ${saveResult.success ? 'succeeded' : 'failed'} DEX save (DC ${finalSaveDc}) and took ${damageOnSave} Force damage (${rollDisplay}).`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error(`[${featureName}] Error:`, e); });
}

async function handleZeroOnSuccessHalfOnFail(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Intervene Shield';

    setRuntimeValue(playerName, 'interveneShieldActive', true, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated ${featureName}. Next Dex save for half damage: no damage on success, half on fail.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[damageReduction] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName} activated. The next time you would take damage from an effect that allows a Dexterity saving throw for half damage, you take no damage on a successful save and half damage on a failed save.`,
            automation: auto,
        },
    };
}
