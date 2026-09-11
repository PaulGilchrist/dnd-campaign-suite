import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { grantTempHpOnRage } from '../buffs/tempHpBuffHandler.js';
import { clearExtendedFlag } from '../class-warlock/tempTeleportHandler.js';
import { addEntry } from '../../../ui/logService.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

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

export async function handle(action, playerStats, campaignName, _mapName) {
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
                payload: { action, playerStats, campaignName, _mapName },
            };
        }
        const newBuffs = activeBuffs.filter(b => b.name !== action.name);
        if (action.name === 'Rage') {
            // CLA-378: leftover Vitality of the Tree temp HP must vanish when Rage ends.
            const strippedTargets = (getRuntimeValue(playerName, 'vitalityOfTheTreeGrantedTargets', campaignName) || [])
                .map(g => (g && g.target) || g)
                .filter(Boolean);
            const remainingBuffs = newBuffs.filter(b => b.name !== 'Rage of the Gods');
            clearExtendedFlag(playerName, campaignName);
            await setRuntimeValue(playerName, 'activeBuffs', remainingBuffs, campaignName);
            await setRuntimeValue(playerName, 'tempHp', 0, campaignName);
            await setRuntimeValue(playerName, 'vitalityOfTheTreeAvailable', false, campaignName);
            await setRuntimeValue(playerName, 'vitalityOfTheTreeRageRound', null, campaignName);
            await setRuntimeValue(playerName, 'vitalityOfTheTreeGrantedTargets', null, campaignName);
            for (const targetName of strippedTargets) {
                await setRuntimeValue(targetName, 'tempHp', 0, campaignName);
            }
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Rage',
                description: `${playerName}'s Rage ended. Vitality of the Tree temporary hit points vanish${strippedTargets.length > 0 ? ` for ${strippedTargets.join(', ')}` : ''}.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[combatStanceHandler:log-error]", e); });
        } else {
            await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
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

    const isWildHeart = action.name === 'Rage of the Wilds';

    const gate = await consumeStanceResource(action, auto, playerStats, campaignName, isWildHeart, maxUses);
    if (gate.popup) return gate.popup;
    const currentUses = gate.currentUses;

    const resistanceTypes = chosenOption
        ? resolveResistanceTypes(getOptionProperty(chosenOption, 'resistanceTypes', []))
        : (auto.resistanceTypes || []);

    const isImprovedDuplicity = auto.effect === 'create_illusion' && playerStats.automation?.passives?.some(p => p.effect === 'enhanced_distraction_and_healing');

    const buff = buildStanceBuff(action, auto, chosenOption, playerStats, resistanceTypes, isImprovedDuplicity);

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const newBuffs = [...activeBuffs, buff];
    // CLA-378: for Rage the buff write is deferred until after the triggerOnRage
    // temp HP grant so its full-store POST is the last (superset) write (§6-#18).
    if (action.name !== 'Rage') {
        await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);
    }

    if (isWildHeart && chosenOption) {
        addEntry(campaignName, {
            type: 'automation',
            automationType: 'Rage of the Wilds',
            creatureName: playerName,
            description: `Selected ${chosenOption.name} wild form`,
        }).catch((e) => { console.error("[combatStanceHandler:log-error]", e); });
    }

    const specialActions = playerStats.automation?.specialActions || [];

    if (action.name === 'Rage') {
        const rageModal = await runRageActivation(auto, playerStats, newBuffs, specialActions, campaignName);
        if (rageModal) return rageModal;
    }

    const illusionModal = resolveIllusionFollowUp(action, auto, playerStats, isImprovedDuplicity, campaignName);
    if (illusionModal) return illusionModal;

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
        description = describeChosenOption(chosenOption, playerStats, playerName, campaignName);
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

function stanceRefusal(action, auto, description) {
    return {
        popup: {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description,
                automation: auto,
            },
        },
    };
}

// Resource gates for stance activation: Wild Heart prerequisite, tracked uses,
// Channel Divinity, or rage-point pool. Returns { popup } to refuse activation.
async function consumeStanceResource(action, auto, playerStats, campaignName, isWildHeart, maxUses) {
    const playerName = playerStats.name;

    if (isWildHeart) {
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        const hasRageActive = activeBuffs.some(b => b.name === 'Rage');
        if (!hasRageActive) {
            return stanceRefusal(action, auto, 'Rage of the Wilds requires Rage to be active.');
        }
        return { currentUses: 0 };
    }

    if (maxUses > 0) {
        const usesKey = auto.resourceKey || (action.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? maxUses);
        if (currentUses <= 0) {
            return stanceRefusal(action, auto, `${action.name} has been used and cannot be used again until a Long Rest.`);
        }
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
        return { currentUses };
    }

    if (auto.resourceCost === 'channel_divinity') {
        return consumeChannelDivinityCharge(action, auto, playerStats, campaignName, playerName);
    }

    return consumeRagePointResource(action, auto, playerStats, campaignName, playerName);
}

async function consumeChannelDivinityCharge(action, auto, playerStats, campaignName, playerName) {
    const storedCharges = getRuntimeValue(playerName, 'channelDivinityCharges', campaignName);
    const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
    const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
    const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

    if (currentCharges <= 0) {
        return stanceRefusal(action, auto, 'No Channel Divinity charges remaining.');
    }

    await setRuntimeValue(playerName, 'channelDivinityCharges', currentCharges - 1, campaignName);
    return { currentUses: 0 };
}

async function consumeRagePointResource(action, auto, playerStats, campaignName, playerName) {
    const resourceKey = auto.resourceKey || 'ragePoints';
    const storedResource = getRuntimeValue(playerName, resourceKey, campaignName);
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const is2024 = playerStats.rules === '2024';
    const maxRage = is2024
        ? (classLevel?.rages || 0)
        : (classLevel?.class_specific?.rage_count || 0);
    const currentResource = storedResource != null ? Number(storedResource) : (playerStats._trackedResources?.ragePoints?.current ?? maxRage);

    if (currentResource <= 0) {
        return stanceRefusal(action, auto, `No ${action.name} uses remaining.`);
    }

    await setRuntimeValue(playerName, resourceKey, currentResource - 1, campaignName);
    return { currentUses: 0 };
}

function buildBaseStanceBuff(action, auto, chosenOption, isImprovedDuplicity, resistanceTypes) {
    return {
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
}

const STANCE_OPTION_EFFECTS = {
    ice_walk: () => ({ effect: 'ice_walk' }),
    speed_boost: opt => ({ effect: 'speed_boost', speedBonus: opt.speedBonus || 10 }),
    fly_speed: () => ({ effect: 'fly_speed_equals_walk_speed', flySpeed: 'equals_walk_speed' }),
    teleport: opt => ({ effect: 'teleport_ready', teleportDistance: opt.teleportDistance || '30 ft' }),
};

function buildStanceBuff(action, auto, chosenOption, playerStats, resistanceTypes, isImprovedDuplicity) {
    const buff = buildBaseStanceBuff(action, auto, chosenOption, isImprovedDuplicity, resistanceTypes);

    if (chosenOption && chosenOption.flySpeed) {
        const blockedByArmor = chosenOption.noArmor && isWearingArmor(playerStats);
        if (!blockedByArmor) {
            buff.effect = 'fly_speed_equals_walk_speed';
            buff.flySpeed = chosenOption.flySpeed;
        }
    } else if (!chosenOption && auto.flySpeed) {
        buff.flySpeed = auto.flySpeed;
    }

    const applyOptionEffect = chosenOption && STANCE_OPTION_EFFECTS[chosenOption.effect];
    if (applyOptionEffect) Object.assign(buff, applyOptionEffect(chosenOption));

    if (auto.reactionSave) {
        buff.reactionSave = auto.reactionSave;
    }
    return buff;
}

// CLA-378: rage anchor writes, charmed/frightened clear, triggerOnRage temp HP
// surge, then the last (superset) activeBuffs POST. Returns a follow-up modal if any.
async function runRageActivation(auto, playerStats, newBuffs, specialActions, campaignName) {
    const playerName = playerStats.name;

    const currentRound = getCurrentCombatRound(campaignName);
    await setRuntimeValue(playerName, 'vitalityOfTheTreeRageRound', currentRound, campaignName);
    await setRuntimeValue(playerName, 'vitalityOfTheTreeGrantedTargets', null, campaignName);
    await setRuntimeValue(playerName, 'vitalityOfTheTreeAvailable', false, campaignName);

    const currentConditions = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
    if (Array.isArray(currentConditions)) {
        const filtered = currentConditions.filter(c => {
            const lower = String(c).toLowerCase();
            return lower !== 'charmed' && lower !== 'frightened';
        });
        if (filtered.length !== currentConditions.length) {
            await setRuntimeValue(playerName, 'activeConditions', filtered, campaignName);
        }
    }

    let surgeAmount = 0;
    let surgeName = '';
    for (const sa of specialActions) {
        if (sa.triggerOnRage) {
            // CLA-378: awaited so the temp HP write lands before the buff POST (§6-#18 race).
            const amount = await grantTempHpOnRage({ name: sa.name, automation: sa }, playerStats, campaignName);
            if (typeof amount === 'number' && amount > surgeAmount) {
                surgeAmount = amount;
                surgeName = sa.name;
            }
        }
    }

    // Last (superset) full-store POST: carries buffs + rage anchor + surge THP together.
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Rage',
        description: surgeAmount > 0
            ? `${playerName} activated Rage. ${surgeName} (Vitality Surge) grants ${surgeAmount} temporary hit points.`
            : `${playerName} activated Rage.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[combatStanceHandler:log-error]", e); });

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
    return null;
}

function resolveIllusionFollowUp(action, auto, playerStats, isImprovedDuplicity, campaignName) {
    if (auto.effect !== 'create_illusion') return null;
    if (isImprovedDuplicity) {
        return {
            type: 'modal',
            modalName: 'invokeDuplicity',
            payload: { action, playerStats, campaignName },
        };
    }
    const illusionTeleport = (playerStats.automation?.specialActions || []).find(sa => sa.effect === 'teleport_swap_with_illusion');
    if (illusionTeleport) {
        // CLA-366: automation.specialActions entries are FLAT automation
        // objects — re-wrap as {name, automation} so TeleportModal sees
        // effect:'teleport_swap_with_illusion' and renders the swap panel
        // instead of the generic Rage teleport chooser.
        return {
            type: 'modal',
            modalName: 'teleport',
            payload: { action: { name: illusionTeleport.name, automation: illusionTeleport }, playerStats, campaignName, triggeredByDuplicity: true },
        };
    }
    return null;
}

function describeChosenOption(chosenOption, playerStats, playerName, campaignName) {
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
    return `${chosenOption.name} chosen. ${optionEffects.join(' ')} (${remainingRage} Rage use(s) remaining)`;
}
