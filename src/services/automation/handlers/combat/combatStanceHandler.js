import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { grantTempHpOnRage } from '../buffs/tempHpBuffHandler.js';
import { clearExtendedFlag } from '../class-warlock/tempTeleportHandler.js';
import { addEntry } from '../../../ui/logService.js';

function resolveResistanceTypes(resistanceTypes) {
    return resistanceTypes.flatMap(rt => {
        if (rt === 'all_except_force_necrotic_psychic_radiant') {
            return ['acid', 'bludgeoning', 'cold', 'fire', 'lightning', 'piercing', 'poison', 'slashing', 'thunder'];
        }
        return rt;
    });
}

function getOptionProperty(option, prop, defaultValue) {
    const val = option[prop];
    return val != null ? val : defaultValue;
}

function isWearingArmor(playerStats) {
    const formula = playerStats.armorClassFormula || '';
    return formula.includes('Armor (');
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === action.name);

    if (wasActive && action.name !== 'Rage of the Wilds') {
        if (auto.effect === 'create_illusion' && playerStats.automation?.passives?.some(p => p.effect === 'enhanced_distraction_and_healing')) {
            return {
                type: 'modal',
                modalName: 'healingIllusion',
                payload: { action, playerStats, campaignName, mapName },
            };
        }
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
        if (action.name === 'Rage') {
            clearExtendedFlag(playerName, campaignName);
        }
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} ended`,
                automation: auto,
            },
        };
    }

    if (action.name === 'Rage of the Wilds') {
        return {
            type: 'modal',
            modalName: 'combatStance',
            payload: { action, playerStats, campaignName },
        };
    }

    const options = auto.options || [];
    if (options.length > 0) {
        return {
            type: 'modal',
            modalName: 'combatStance',
            payload: { action, playerStats, campaignName },
        };
    }

    return activateStance(action, playerStats, campaignName, null);
}

export async function applyStanceOption(action, playerStats, campaignName, optionName) {
    const auto = action.automation;
    const options = auto.options || [];
    const chosenOption = options.find(o => o.name === optionName);
    if (!chosenOption) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Invalid option: ${optionName}`,
                automation: auto,
            },
        };
    }
    return activateStance(action, playerStats, campaignName, chosenOption);
}

async function activateStance(action, playerStats, campaignName, chosenOption) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const maxUses = auto.uses || 0;
    let currentUses = 0;

    const isWildHeart = action.name === 'Rage of the Wilds';

    if (isWildHeart) {
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        const hasRageActive = activeBuffs.some(b => b.name === 'Rage');
        if (!hasRageActive) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: 'Rage of the Wilds requires Rage to be active.',
                    automation: auto,
                },
            };
        }
    } else if (maxUses > 0) {
        const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
        currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? maxUses);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} has been used and cannot be used again until a Long Rest.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    } else if (auto.resourceCost === 'channel_divinity') {
        const storedCharges = getRuntimeValue(playerName, 'channelDivinityCharges', campaignName);
        const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
        const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
        const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

        if (currentCharges <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: 'No Channel Divinity charges remaining.',
                    automation: auto,
                },
            };
        }

        await setRuntimeValue(playerName, 'channelDivinityCharges', currentCharges - 1, campaignName);
    } else {
        const resourceKey = auto.resourceKey || 'ragePoints';
        const storedResource = getRuntimeValue(playerName, resourceKey, campaignName);
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
        const is2024 = playerStats.rules === '2024';
        const maxRage = is2024
            ? (classLevel?.rages || 0)
            : (classLevel?.class_specific?.rage_count || 0);
        const currentResource = storedResource != null ? Number(storedResource) : (playerStats._trackedResources?.ragePoints?.current ?? maxRage);

        if (currentResource <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `No ${action.name} uses remaining.`,
                    automation: auto,
                },
            };
        }

        await setRuntimeValue(playerName, resourceKey, currentResource - 1, campaignName);
    }

    const resistanceTypes = chosenOption
        ? resolveResistanceTypes(getOptionProperty(chosenOption, 'resistanceTypes', []))
        : (auto.resistanceTypes || []);

    const isImprovedDuplicity = auto.effect === 'create_illusion' && playerStats.automation?.passives?.some(p => p.effect === 'enhanced_distraction_and_healing');

    const buff = {
        name: action.name,
        effect: auto.effect || 'stance',
        duration: auto.duration || '1_minute',
        resistanceTypes,
        advantages: auto.advantages || [],
        damageBonusExpression: auto.damageBonusExpression || '',
        blocksSpellcasting: auto.blocksSpellcasting || false,
        optionName: chosenOption ? chosenOption.name : null,
        noArmor: chosenOption ? (chosenOption.noArmor || false) : false,
        range: chosenOption ? (chosenOption.range || null) : null,
        flySpeed: null,
        reactionSave: null,
        isImprovedDuplicity,
    };

    if (chosenOption && chosenOption.flySpeed) {
        const blockedByArmor = chosenOption.noArmor && isWearingArmor(playerStats);
        if (!blockedByArmor) {
            buff.effect = 'fly_speed_equals_walk_speed';
            buff.flySpeed = chosenOption.flySpeed;
        }
    } else if (!chosenOption && auto.flySpeed) {
        buff.flySpeed = auto.flySpeed;
    }

    if (chosenOption && chosenOption.effect === 'ice_walk') {
        buff.effect = 'ice_walk';
    } else if (chosenOption && chosenOption.effect === 'speed_boost') {
        buff.effect = 'speed_boost';
        buff.speedBonus = chosenOption.speedBonus || 10;
    } else if (chosenOption && chosenOption.effect === 'fly_speed') {
        buff.effect = 'fly_speed_equals_walk_speed';
        buff.flySpeed = 'equals_walk_speed';
    } else if (chosenOption && chosenOption.effect === 'teleport') {
        buff.effect = 'teleport_ready';
        buff.teleportDistance = chosenOption.teleportDistance || '30 ft';
    }

    if (auto.reactionSave) {
        buff.reactionSave = auto.reactionSave;
    }
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = [...activeBuffs, buff];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    if (isWildHeart && chosenOption) {
        addEntry(campaignName, {
            type: 'automation',
            automationType: 'Rage of the Wilds',
            creatureName: playerName,
            description: `Selected ${chosenOption.name} wild form`,
        }).catch(() => {});
    }

    if (action.name === 'Rage') {
        const currentConditions = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
        if (Array.isArray(currentConditions)) {
            const filtered = currentConditions.filter(c => {
                const lower = String(c).toLowerCase();
                return lower !== 'charmed' && lower !== 'frightened';
            });
            if (filtered.length !== currentConditions.length) {
                setRuntimeValue(playerName, 'activeConditions', filtered, campaignName);
            }
        }

        const specialActions = playerStats.automation?.specialActions || [];
        for (const sa of specialActions) {
            if (sa.triggerOnRage) {
                grantTempHpOnRage({ name: sa.name, automation: sa }, playerStats, campaignName);
            }
        }

        const teleportFeature = specialActions.find(sa => sa.effect === 'teleport_on_rage');
        if (teleportFeature) {
            return {
                type: 'modal',
                modalName: 'teleport',
                payload: { action: teleportFeature, playerStats, campaignName, triggeredByRage: true },
            };
        }

        const instinctivePounce = specialActions.find(sa => sa.effect === 'rage_bonus_movement');
        if (instinctivePounce) {
            const speed = playerStats.speed || 30;
            const maxMove = Math.floor(speed / 2);
            auto._instinctivePounce = `${instinctivePounce.name}: You can move up to ${maxMove} feet as part of entering your Rage. Move your token on the combat map.`;
        }
    }

    if (auto.effect === 'create_illusion') {
        if (isImprovedDuplicity) {
            return {
                type: 'modal',
                modalName: 'invokeDuplicity',
                payload: { action, playerStats, campaignName },
            };
        }
        const illusionTeleport = (playerStats.automation?.specialActions || []).find(sa => sa.effect === 'teleport_swap_with_illusion');
        if (illusionTeleport) {
            return {
                type: 'modal',
                modalName: 'teleport',
                payload: { action: illusionTeleport, playerStats, campaignName, triggeredByDuplicity: true },
            };
        }
    }

    if (chosenOption && chosenOption.effect === 'teleport') {
        return {
            type: 'modal',
            modalName: 'teleport',
            payload: { action, playerStats, campaignName, triggeredByElementalStride: true },
        };
    }

    let description = maxUses > 0
        ? `${action.name} activated (${currentUses - 1}/${maxUses} uses remaining)`
        : `${action.name} activated`;
    if (auto._instinctivePounce) {
        description += `\n\n${auto._instinctivePounce}`;
    }
    if (auto.effect === 'create_illusion') {
        description += ' While active, you can cast spells as though you were in the illusion\'s space.';
    }
    if (chosenOption) {
        const optionEffects = [];
        if (chosenOption.name === 'Bear') {
            optionEffects.push('Resistance to Acid, Bludgeoning, Cold, Fire, Lightning, Piercing, Poison, Slashing, Thunder');
        } else if (chosenOption.name === 'Eagle') {
            optionEffects.push('You can take the Disengage and Dash action as part of this Bonus Action. While raging, you can take a Bonus Action to do both again.');
        } else if (chosenOption.name === 'Wolf') {
            optionEffects.push('While raging, allies have Advantage on attack rolls against enemies within 5 feet of you.');
        } else if (chosenOption.name === 'Falcon') {
            optionEffects.push('While raging, you have a Fly Speed equal to your Speed if you are not wearing armor.');
        } else if (chosenOption.name === 'Lion') {
            optionEffects.push('While raging, enemies within 5 feet of you have Disadvantage on attack rolls against targets other than you or another Barbarian with this option active.');
        } else if (chosenOption.name === 'Ram') {
            optionEffects.push('While raging, you can cause a Large or smaller creature to have the Prone condition when you hit it with a melee attack.');
        } else if (chosenOption.name === 'Cold') {
            optionEffects.push('Ice Walk: You can walk across and climb icy or wet surfaces without needing to make an Ability Check. You ignore difficult terrain that is composed of ice or snow.');
        } else if (chosenOption.name === 'Fire') {
            optionEffects.push(`Speed Boost: Your Speed increases by ${chosenOption.speedBonus || 10} feet.`);
        } else if (chosenOption.name === 'Lightning') {
            optionEffects.push('Fly Speed: You gain a Fly Speed equal to your Speed for 1 round.');
        } else if (chosenOption.name === 'Thunder') {
            optionEffects.push(`Teleport: You can teleport up to ${chosenOption.teleportDistance || '30 ft'} to an unoccupied space you can see.`);
        }
        if (chosenOption.name === 'Falcon' && chosenOption.flySpeed && chosenOption.noArmor && isWearingArmor(playerStats)) {
            optionEffects.push('Blocked because you are wearing armor.');
        }
        const remainingRage = Number(getRuntimeValue(playerName, 'ragePoints', campaignName) ?? 0);
        description = `${chosenOption.name} chosen. ${optionEffects.join(' ')} (${remainingRage} Rage use(s) remaining)`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description,
            automation: auto,
        },
    };
}
