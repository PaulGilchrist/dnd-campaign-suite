import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

const GIANT_ANCESTRY_KEY = 'giantAncestrySelection';

const GIANT_OPTIONS = [
    {
        name: "Cloud's Jaunt",
        type: 'teleport',
        range: '30_ft',
        description: 'Teleport up to 30 feet to an unoccupied space you can see.',
        icon: 'fa-cloud',
    },
    {
        name: "Fire's Burn",
        type: 'damage',
        damage: '1d10',
        damageType: 'Fire',
        description: 'Deal 1d10 fire damage to a creature within 30 feet.',
        icon: 'fa-fire',
    },
    {
        name: "Frost's Chill",
        type: 'damage_with_condition',
        damage: '1d6',
        damageType: 'Cold',
        condition: 'speed_reduction',
        value: '10_ft',
        description: 'Deal 1d6 cold damage and reduce target speed by 10 feet for 1 minute.',
        icon: 'fa-snowflake',
    },
    {
        name: "Hill's Tumble",
        type: 'auto_effect',
        trigger: 'melee_hit',
        effect: 'prone',
        description: 'When you hit a creature with a melee attack, you can knock it prone.',
        icon: 'fa-person-falling',
    },
    {
        name: "Stone's Endurance",
        type: 'damage_reduction',
        reductionExpression: '1d10 + CON modifier',
        description: 'When you take damage, you can reduce it by 1d10 + CON modifier.',
        icon: 'fa-shield',
    },
    {
        name: "Storm's Thunder",
        type: 'reaction_damage',
        damage: '1d8',
        damageType: 'Thunder',
        range: '60_ft',
        description: 'As a reaction, make a ranged spell attack against one creature within 60 feet. On a hit, the target takes 1d8 thunder damage.',
        icon: 'fa-bolt',
    },
];

function getRuntimeUsesKey(featureName) {
    const cleaned = featureName.toLowerCase().replace(/'/g, '');
    return cleaned.replace(/ (\w)/g, (_, c) => c.toUpperCase()) + 'Uses';
}

function getOptionByName(name) {
    return GIANT_OPTIONS.find(o => o.name === name);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const storedSelection = getRuntimeValue(playerStats.name, GIANT_ANCESTRY_KEY, campaignName);

    // If no selection made yet, show the selection modal
    if (!storedSelection) {
        return {
            type: 'modal',
            modalName: 'giantAncestry',
            payload: {
                action,
                playerStats,
                campaignName,
            },
        };
    }

    const option = getOptionByName(storedSelection);
    if (!option) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Giant Ancestry: ${storedSelection} (already selected).`,
                automation: action.automation,
            },
        };
    }

    // Dispatch to the appropriate handler based on the selected option type
    switch (option.type) {
    case 'teleport':
        return await handleCloudsJaunt(action, playerStats, campaignName, option);
    case 'damage':
        return await handleFiresBurn(action, playerStats, campaignName, option);
    case 'damage_with_condition':
        return await handleFrostsChill(action, playerStats, campaignName, option);
    case 'auto_effect':
        return await handleHillsTumble(action, playerStats, campaignName, option);
    case 'damage_reduction':
        return await handleStonesEndurance(action, playerStats, campaignName, option);
    case 'reaction_damage':
        return await handleStormsThunder(action, playerStats, campaignName, option);
    default:
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Giant Ancestry: Unknown option type "${option.type}".`,
                automation: action.automation,
            },
        };
    }
}

// Direct handlers for individual giant ancestry traits (no selection flow)
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
    const usesKey = getRuntimeUsesKey("Fire's Burn");
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Fire's Burn",
                description: "Fire's Burn has no uses remaining. Uses will reset on the next Long Rest.",
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
                name: "Fire's Burn",
                description: "Fire's Burn requires a recent attack. Use it after hitting a creature.",
                automation: action.automation,
            },
        };
    }

    if (lastAttack.attackerName !== playerStats.name) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Fire's Burn",
                description: "Fire's Burn can only be used after you make an attack. Wait for your turn.",
                automation: action.automation,
            },
        };
    }

    if (lastAttack.attackEvent.rollType !== 'attack') {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Fire's Burn",
                description: "Fire's Burn can only be used after an attack roll.",
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
                name: "Fire's Burn",
                description: "Fire's Burn requires a target. No target found from the last attack.",
                automation: action.automation,
            },
        };
    }

    const damageResult = rollExpression(action.automation.damage || '1d10');
    const damageType = action.automation.damageType || 'Fire';

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const cs = await getCombatContext(campaignName);
    const characters = cs?.creatures?.filter(c => c.type === 'player') || [];
    const applyResult = applyDamageToTarget(cs, targetName, damageResult?.total ?? 0, [damageType], campaignName, characters, false, playerStats.name);
    const actualDamage = applyResult?.finalDamage ?? damageResult?.total ?? 0;
    const newHp = applyResult?.newHp;

    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'damage',
        name: "Fire's Burn" + ' Damage',
        targetName,
        damageType,
        total: actualDamage,
        formula: action.automation.damage || '1d10',
        rolls: damageResult?.rolls,
        description: `${playerStats.name} used Fire's Burn to deal ${actualDamage} fire damage to ${targetName}.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'damage',
            name: "Fire's Burn",
            formula: action.automation.damage || '1d10',
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

export async function handleFrostsChillDirect(action, playerStats, campaignName) {
    const usesKey = getRuntimeUsesKey("Frost's Chill");
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Frost's Chill",
                description: "Frost's Chill has no uses remaining. Uses will reset on the next Long Rest.",
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
                name: "Frost's Chill",
                description: "Frost's Chill requires a recent attack. Use it after hitting a creature.",
                automation: action.automation,
            },
        };
    }

    if (lastAttack.attackerName !== playerStats.name) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Frost's Chill",
                description: "Frost's Chill can only be used after you make an attack. Wait for your turn.",
                automation: action.automation,
            },
        };
    }

    if (lastAttack.attackEvent.rollType !== 'attack') {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Frost's Chill",
                description: "Frost's Chill can only be used after an attack roll.",
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
                name: "Frost's Chill",
                description: "Frost's Chill requires a target. No target found from the last attack.",
                automation: action.automation,
            },
        };
    }

    const damageResult = rollExpression(action.automation.damage || '1d6');
    const damageType = action.automation.damageType || 'Cold';
    const speedReduction = parseInt(action.automation.value?.replace('_ft', ''), 10) || 10;

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const cs = await getCombatContext(campaignName);
    const characters = cs?.creatures?.filter(c => c.type === 'player') || [];
    const applyResult = applyDamageToTarget(cs, targetName, damageResult?.total ?? 0, [damageType], campaignName, characters, false, playerStats.name);
    const actualDamage = applyResult?.finalDamage ?? damageResult?.total ?? 0;
    const newHp = applyResult?.newHp;

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const filteredEffects = storedEffects.filter(te => !(te.target === targetName && te.effect === 'speed_reduction'));
    const speedEffect = {
        target: targetName,
        source: "Frost's Chill",
        effect: 'speed_reduction',
        value: speedReduction,
        duration: 'until_end_of_next_turn',
    };
    await setRuntimeValue(campaignName, 'targetEffects', [...filteredEffects, speedEffect], campaignName);

    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'damage',
        name: "Frost's Chill" + ' Damage',
        targetName,
        damageType,
        total: actualDamage,
        formula: action.automation.damage || '1d6',
        rolls: damageResult?.rolls,
        description: `${playerStats.name} used Frost's Chill to deal ${actualDamage} cold damage to ${targetName}.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    await addEntry(campaignName, {
        type: 'condition',
        characterName: playerStats.name,
        targetName,
        condition: 'speed_reduction',
        source: "Frost's Chill",
        description: `${playerStats.name} used Frost's Chill to reduce ${targetName}'s speed by ${speedReduction} ft until the end of their next turn.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'damage',
            name: "Frost's Chill",
            formula: action.automation.damage || '1d6',
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

    const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    if (storedConds.includes('prone')) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: optName,
                description: `${targetName} is already prone.`,
                automation: action.automation,
            },
        };
    }

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const newConds = Array.isArray(storedConds) ? [...storedConds, 'prone'] : ['prone'];
    await setRuntimeValue(targetName, 'activeConditions', newConds, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: optName,
        description: `${playerStats.name} used ${optName} to knock ${targetName} prone.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    await addEntry(campaignName, {
        type: 'condition',
        characterName: playerStats.name,
        targetName,
        condition: 'prone',
        source: optName,
        description: `${playerStats.name} used ${optName} to apply the prone condition to ${targetName}.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: optName,
            automationType: 'hills_tumble',
            description: `${optName}: Knocked <strong>${targetName}</strong> prone.`,
            automation: action.automation,
        },
    };
}

export async function handleStonesEnduranceDirect(action, playerStats, campaignName) {
    const usesKey = getRuntimeUsesKey("Stone's Endurance");
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Stone's Endurance",
                description: "Stone's Endurance has no uses remaining. Recharges on a Long Rest.",
                automation: action.automation,
            },
        };
    }

    const reduction = evaluateAutoExpression(action.automation.reductionExpression || '1d12 + CON modifier', playerStats);
    const reductionDisplay = typeof reduction === 'number' ? String(reduction) : (reduction || action.automation.reductionExpression || '1d12 + CON modifier');

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: "Stone's Endurance",
        description: `${playerStats.name} used Stone's Endurance to reduce damage by ${reductionDisplay}.`,
    });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: "Stone's Endurance",
            automationType: 'stones_endurance',
            description: `Stone's Endurance: Reduce damage by <strong>${reductionDisplay}</strong>.`,
            automation: action.automation,
        },
    };
}

export async function handleStormsThunderDirect(action, playerStats, campaignName, _mapName) {
    const usesKey = getRuntimeUsesKey("Storm's Thunder");
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Storm's Thunder",
                description: "Storm's Thunder has no uses remaining. Recharges on a Long Rest.",
                automation: action.automation,
            },
        };
    }

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    if (!targetInfo?.target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Storm's Thunder",
                description: "Storm's Thunder requires a target. Select a creature in combat.",
                automation: action.automation,
            },
        };
    }

    const targetName = targetInfo.target.name;

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const damageResult = rollExpression(action.automation.damage || '1d8');
    const damageDisplay = damageResult ? damageResult.total : (action.automation.damage || '1d8');
    const damageType = action.automation.damageType || 'Thunder';

    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'damage',
        name: "Storm's Thunder" + ' Damage',
        targetName,
        damageType,
        total: damageResult?.total ?? 0,
        formula: action.automation.damage || '1d8',
        rolls: damageResult?.rolls,
        description: `${playerStats.name} used Storm's Thunder to deal ${damageDisplay} thunder damage to ${targetName} as a reaction.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: "Storm's Thunder",
            automationType: 'storms_thunder',
            description: `Storm's Thunder: Dealt <strong>${damageDisplay}</strong> thunder damage to ${targetName}.`,
            automation: action.automation,
        },
    };
}

// Direct handlers for when the automation type is called directly (teleport, damage, etc.)
export async function handleDirectType(action, playerStats, campaignName, _mapName) {
    const storedSelection = getRuntimeValue(playerStats.name, GIANT_ANCESTRY_KEY, campaignName);

    if (!storedSelection) {
        return {
            type: 'modal',
            modalName: 'giantAncestry',
            payload: {
                action,
                playerStats,
                campaignName,
            },
        };
    }

    const option = getOptionByName(storedSelection);
    if (!option) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Giant Ancestry: ${storedSelection} (already selected).`,
                automation: action.automation,
            },
        };
    }

    const directType = action.automation?.type || '';

    // If the automation type matches the selected option type, dispatch directly
    if (directType === option.type) {
        switch (option.type) {
        case 'teleport':
            return await handleCloudsJaunt(action, playerStats, campaignName, option);
        case 'damage':
            return await handleFiresBurn(action, playerStats, campaignName, option);
        case 'damage_with_condition':
            return await handleFrostsChill(action, playerStats, campaignName, option);
        case 'auto_effect':
            return await handleHillsTumble(action, playerStats, campaignName, option);
        case 'damage_reduction':
            return await handleStonesEndurance(action, playerStats, campaignName, option);
        case 'reaction_damage':
            return await handleStormsThunder(action, playerStats, campaignName, option);
        default:
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `Giant Ancestry: Unknown option type "${option.type}".`,
                    automation: action.automation,
                },
            };
        }
    }

    // Type doesn't match - show info that wrong option was selected
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Giant Ancestry: ${storedSelection} is selected. To use ${directType}, change your selection.`,
            automation: action.automation,
        },
    };
}

export async function handleCloudsJaunt(action, playerStats, campaignName, option) {
    const optName = (option?.name || action.name || "Cloud's Jaunt");
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

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: optName,
        description: `${playerStats.name} used ${optName} to teleport up to 30 feet to an unoccupied space they can see.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: optName,
            automationType: 'teleport',
            description: `${optName}: Teleported up to 30 feet to an unoccupied space they can see.`,
            automation: action.automation,
        },
    };
}

export async function handleFiresBurn(action, playerStats, campaignName, option) {
    const optName = (option?.name || action.name || "Fire's Burn");
    const opt = option || action.automation;
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

    const damageResult = rollExpression(opt.damage);
    const damageType = opt.damageType || 'Fire';

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const cs = await getCombatContext(campaignName);
    const characters = cs?.creatures?.filter(c => c.type === 'player') || [];
    const applyResult = applyDamageToTarget(cs, targetName, damageResult?.total ?? 0, [damageType], campaignName, characters, false, playerStats.name);
    const actualDamage = applyResult?.finalDamage ?? damageResult?.total ?? 0;
    const newHp = applyResult?.newHp;

    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'damage',
        name: optName + ' Damage',
        targetName,
        damageType,
        total: actualDamage,
        formula: opt.damage,
        rolls: damageResult?.rolls,
        description: `${playerStats.name} used ${optName} to deal ${actualDamage} ${damageType} damage to ${targetName}.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'damage',
            name: optName,
            formula: opt.damage,
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
export async function handleFrostsChill(action, playerStats, campaignName, option) {
    const optName = (option?.name || action.name || "Frost's Chill");
    const opt = option || action.automation;
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

    const damageResult = rollExpression(opt.damage);
    const damageType = opt.damageType || 'Cold';
    const speedReduction = parseInt(opt.value?.replace('_ft', ''), 10) || 10;

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const cs = await getCombatContext(campaignName);
    const characters = cs?.creatures?.filter(c => c.type === 'player') || [];
    const applyResult = applyDamageToTarget(cs, targetName, damageResult?.total ?? 0, [damageType], campaignName, characters, false, playerStats.name);
    const actualDamage = applyResult?.finalDamage ?? damageResult?.total ?? 0;
    const newHp = applyResult?.newHp;

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const filteredEffects = storedEffects.filter(te => !(te.target === targetName && te.effect === 'speed_reduction'));
    const speedEffect = {
        target: targetName,
        source: optName,
        effect: 'speed_reduction',
        value: speedReduction,
        duration: 'until_end_of_next_turn',
    };
    await setRuntimeValue(campaignName, 'targetEffects', [...filteredEffects, speedEffect], campaignName);

    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'damage',
        name: optName + ' Damage',
        targetName,
        damageType,
        total: actualDamage,
        formula: opt.damage,
        rolls: damageResult?.rolls,
        description: `${playerStats.name} used ${optName} to deal ${actualDamage} ${damageType} damage to ${targetName}.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    await addEntry(campaignName, {
        type: 'condition',
        characterName: playerStats.name,
        targetName,
        condition: 'speed_reduction',
        source: optName,
        description: `${playerStats.name} used ${optName} to reduce ${targetName}'s speed by ${speedReduction} ft until the end of their next turn.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'damage',
            name: optName,
            formula: opt.damage,
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

export async function handleHillsTumble(action, playerStats, campaignName, option) {
    const optName = (option?.name || action.name || "Hill's Tumble");
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

    const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    if (storedConds.includes('prone')) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: optName,
                description: `${targetName} is already prone.`,
                automation: action.automation,
            },
        };
    }

    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const newConds = Array.isArray(storedConds) ? [...storedConds, 'prone'] : ['prone'];
    await setRuntimeValue(targetName, 'activeConditions', newConds, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: optName,
        description: `${playerStats.name} used ${optName} to knock ${targetName} prone.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    await addEntry(campaignName, {
        type: 'condition',
        characterName: playerStats.name,
        targetName,
        condition: 'prone',
        source: optName,
        description: `${playerStats.name} used ${optName} to apply the prone condition to ${targetName}.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: optName,
            automationType: action.automation.type,
            description: `${optName}: Knocked <strong>${targetName}</strong> prone.`,
            automation: action.automation,
        },
    };
}

export async function handleStonesEndurance(action, playerStats, campaignName, option) {
    const optName = (option?.name || action.name || "Stone's Endurance");
    const opt = option || action.automation;
    const usesKey = getRuntimeUsesKey(optName);
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: optName,
                description: `${optName} has no uses remaining. Recharges on a Long Rest.`,
                automation: action.automation,
            },
        };
    }

    const reduction = evaluateAutoExpression(opt.reductionExpression, playerStats);
    const reductionDisplay = typeof reduction === 'number' ? String(reduction) : (reduction || opt.reductionExpression);

    // Consume the use
    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: optName,
        description: `${playerStats.name} used ${optName} to reduce damage by ${reductionDisplay}.`,
    });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: optName,
            automationType: opt.type,
            description: `${optName}: Reduce damage by <strong>${reductionDisplay}</strong>.`,
            automation: action.automation,
        },
    };
}

export async function handleStormsThunder(action, playerStats, campaignName, _mapName, option) {
    const optName = (option?.name || action.name || "Storm's Thunder");
    const opt = option || action.automation;
    const usesKey = getRuntimeUsesKey(optName);
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: optName,
                description: `${optName} has no uses remaining. Recharges on a Long Rest.`,
                automation: action.automation,
            },
        };
    }

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    if (!targetInfo?.target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: optName,
                description: `${optName} requires a target. Select a creature in combat.`,
                automation: action.automation,
            },
        };
    }

    const targetName = targetInfo.target.name;

    // Consume the use
    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const damageResult = rollExpression(opt.damage);
    const damageDisplay = damageResult ? damageResult.total : opt.damage;

    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerStats.name,
        rollType: 'damage',
        name: optName + ' Damage',
        targetName,
        damageType: opt.damageType,
        total: damageResult?.total ?? 0,
        formula: opt.damage,
        rolls: damageResult?.rolls,
        description: `${playerStats.name} used ${optName} to deal ${damageDisplay} ${opt.damageType} damage to ${targetName} as a reaction.`,
    }).catch((e) => { console.error("[giantAncestry] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: optName,
            automationType: opt.type,
            description: `${optName}: Dealt <strong>${damageDisplay}</strong> ${opt.damageType} damage to ${targetName}.`,
            automation: action.automation,
        },
    };
}

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
