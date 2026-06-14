import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { rollExpression } from '../../dice/diceRoller.js';
import { addEntry } from '../../ui/logService.js';
import { resolveTarget } from '../common/targetResolver.js';
import { evaluateAutoExpression } from '../../combat/automationService.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/damageUtils.js';

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
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
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
    const usesKey = getRuntimeUsesKey(option.name);
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: option.name,
                description: `${option.name} has no uses remaining. Recharges on a Short or Long Rest.`,
                automation: action.automation,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'teleport',
        payload: {
            action: {
                ...action,
                name: option.name,
                automation: {
                    ...action.automation,
                    type: 'teleport',
                    effect: 'teleport',
                    distance: option.range.replace('_ft', ' ft') || '30 ft',
                    range: option.range,
                },
            },
            playerStats,
            campaignName,
        },
    };
}

export async function handleFiresBurn(action, playerStats, campaignName, option) {
    const usesKey = getRuntimeUsesKey(option.name);
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: option.name,
                description: `${option.name} has no uses remaining. Recharges on a Short or Long Rest.`,
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
                name: option.name,
                description: `${option.name} requires a target. Select a creature in combat.`,
                automation: action.automation,
            },
        };
    }

    const targetName = targetInfo.target.name;
    const damageResult = rollExpression(option.damage);
    const damageDisplay = damageResult ? damageResult.total : option.damage;

    // Consume the use
    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    await addEntry(campaignName, {
        type: 'damage_roll',
        characterName: playerStats.name,
        targetName,
        damageType: option.damageType,
        total: damageResult?.total ?? 0,
        formula: option.damage,
        description: `${playerStats.name} used ${option.name} to deal ${damageDisplay} ${option.damageType} damage to ${targetName}.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: option.name,
            automationType: option.type,
            description: `${option.name}: Dealt <strong>${damageDisplay}</strong> ${option.damageType} damage to ${targetName}.`,
            automation: action.automation,
        },
    };
}

export async function handleFrostsChill(action, playerStats, campaignName, option) {
    const usesKey = getRuntimeUsesKey(option.name);
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: option.name,
                description: `${option.name} has no uses remaining. Recharges on a Short or Long Rest.`,
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
                name: option.name,
                description: `${option.name} requires a target. Select a creature in combat.`,
                automation: action.automation,
            },
        };
    }

    const targetName = targetInfo.target.name;
    const damageResult = rollExpression(option.damage);
    const damageDisplay = damageResult ? damageResult.total : option.damage;

    // Consume the use
    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    // Apply speed reduction to target
    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const speedEffect = {
        target: targetName,
        source: option.name,
        effect: 'speed_reduction',
        value: parseInt(option.value.replace('_ft', ''), 10) || 10,
        duration: 'until_end_of_next_turn',
    };
    await setRuntimeValue(campaignName, 'targetEffects', [...storedEffects, speedEffect], campaignName);

    await addEntry(campaignName, {
        type: 'damage_roll',
        characterName: playerStats.name,
        targetName,
        damageType: option.damageType,
        total: damageResult?.total ?? 0,
        formula: option.damage,
        description: `${playerStats.name} used ${option.name} to deal ${damageDisplay} ${option.damageType} damage and reduce ${targetName}'s speed by 10 feet.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: option.name,
            automationType: option.type,
            description: `${option.name}: Dealt <strong>${damageDisplay}</strong> ${option.damageType} damage to ${targetName}. Speed reduced by ${(parseInt(option.value.replace('_ft', ''), 10) || 10)} ft for 1 round.`,
            automation: action.automation,
        },
    };
}

export async function handleHillsTumble(action, playerStats, campaignName, option) {
    const usesKey = getRuntimeUsesKey(option.name);
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: option.name,
                description: `${option.name} has no uses remaining. Recharges on a Short or Long Rest.`,
                automation: action.automation,
            },
        };
    }

    // Check if there's a recent hit to apply prone to
    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: option.name,
                description: `${option.name}: No target found. Use this after hitting a creature with a melee attack.`,
                automation: action.automation,
            },
        };
    }

    // Consume the use and apply prone
    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const newConds = Array.isArray(storedConds) ? [...storedConds, 'prone'] : ['prone'];
    await setRuntimeValue(targetName, 'activeConditions', newConds, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: option.name,
        description: `${playerStats.name} used ${option.name} to knock ${targetName} prone.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: option.name,
            automationType: option.type,
            description: `${option.name}: Knocked <strong>${targetName}</strong> prone.`,
            automation: action.automation,
        },
    };
}

export async function handleStonesEndurance(action, playerStats, campaignName, option) {
    const usesKey = getRuntimeUsesKey(option.name);
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: option.name,
                description: `${option.name} has no uses remaining. Recharges on a Short or Long Rest.`,
                automation: action.automation,
            },
        };
    }

    const reduction = evaluateAutoExpression(option.reductionExpression, playerStats);
    const reductionDisplay = typeof reduction === 'number' ? String(reduction) : (reduction || option.reductionExpression);

    // Consume the use
    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: option.name,
        description: `${playerStats.name} used ${option.name} to reduce damage by ${reductionDisplay}.`,
    });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: option.name,
            automationType: option.type,
            description: `${option.name}: Reduce damage by <strong>${reductionDisplay}</strong>.`,
            automation: action.automation,
        },
    };
}

export async function handleStormsThunder(action, playerStats, campaignName, _mapName, option) {
    const usesKey = getRuntimeUsesKey(option.name);
    const usesMax = playerStats.proficiency || 0;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: option.name,
                description: `${option.name} has no uses remaining. Recharges on a Short or Long Rest.`,
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
                name: option.name,
                description: `${option.name} requires a target. Select a creature in combat.`,
                automation: action.automation,
            },
        };
    }

    const targetName = targetInfo.target.name;

    // Consume the use
    await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);

    const damageResult = rollExpression(option.damage);
    const damageDisplay = damageResult ? damageResult.total : option.damage;

    await addEntry(campaignName, {
        type: 'damage_roll',
        characterName: playerStats.name,
        targetName,
        damageType: option.damageType,
        total: damageResult?.total ?? 0,
        formula: option.damage,
        description: `${playerStats.name} used ${option.name} to deal ${damageDisplay} ${option.damageType} damage to ${targetName} as a reaction.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: option.name,
            automationType: option.type,
            description: `${option.name}: Dealt <strong>${damageDisplay}</strong> ${option.damageType} damage to ${targetName}.`,
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
            description: `Selected ${chosenOption}. Uses equal to Proficiency Bonus. Recharges on a Short or Long Rest.`,
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
