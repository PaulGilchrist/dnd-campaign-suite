import { resolveTarget, resolveMapPositions } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { spendSorceryPoints, getCurrentSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { findRollsByCreature } from '../../common/damageRollback.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    if (auto.effect === 'miss_on_failed_save') {
        return handleUnbreakableMajesty(action, playerStats, campaignName);
    }

    if (auto.effect === 'bonus_or_penalty_choice') {
        return handleBendFate(action, playerStats, campaignName, mapName);
    }

    if (auto.effect === 'ac_bonus') {
        return handleAcBonus(action, playerStats, campaignName);
    }

    if (auto.effect === 'zero_on_success_half_on_fail_for_mount') {
        return handleLeapAside(action, playerStats, campaignName);
    }

    if (auto.effect === 'redirect_attack_to_self') {
        return handleVeer(action, playerStats, campaignName);
    }

    return handleInspiringMovement(action, playerStats, campaignName, mapName);
}

async function handleBendFate(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Bend Fate';

    const featureMaxSP = playerStats.automation?.specialActions?.find(a => a.name === 'Sorcery Points')?.uses || 0;
    const maxSP = featureMaxSP || (getClassFeatures(playerStats)?.maxSorceryPoints || 0);
    const currentSP = getCurrentSorceryPoints(playerName, maxSP);

    if (currentSP < 1) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No Sorcery Points available. ${featureName} requires 1 Sorcery Point.`,
                automation: auto,
            },
        };
    }

    const targetInfo = await resolveTarget(campaignName, playerName);
    if (!targetInfo?.target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires selecting a creature in combat.`,
                automation: auto,
            },
        };
    }

    const targetName = targetInfo.target.name;

    if (targetName === playerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} can only be used on another creature, not yourself.`,
                automation: auto,
            },
        };
    }

    if (mapName) {
        const positions = await resolveMapPositions(campaignName, mapName, playerName);
        if (positions?.attackerPos && positions?.targetPos) {
            const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
            if (dist == null) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `Could not determine distance to ${targetName}. Ensure both creatures are placed on the map.`,
                        automation: auto,
                    },
                };
            }
        }
    }

    const rollsByCreature = await findRollsByCreature(campaignName);
    const targetRolls = rollsByCreature?.[targetName] || null;
    const attackEvent = targetRolls?.attackEvent || null;
    const abilityEvent = targetRolls?.abilityEvent || null;
    const saveEvent = targetRolls?.saveEvent || null;

    const attackFresh = attackEvent && !isStale(attackEvent);
    const abilityFresh = abilityEvent && !isStale(abilityEvent);
    const saveFresh = saveEvent && !isStale(saveEvent);

    if (!attackFresh && !abilityFresh && !saveFresh) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent D20 test found for ${targetName}. ${featureName} can only be used shortly after another creature rolls a d20.`,
                automation: auto,
            },
        };
    }

    const d4Roll = rollExpression('1d4');
    if (!d4Roll) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `Roll failed.`,
                automation: auto,
            },
        };
    }

    spendSorceryPoints(playerName, 1, campaignName);

    let rollDescription;
    if (attackFresh) {
        const { d20, bonus, targetName: atkTarget, hit } = attackEvent;
        const ac = atkTarget;
        rollDescription = `Attack roll on ${targetName}: d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${ac != null ? ac : '—'} → ${hit ? 'HIT' : 'MISS'}`;
    } else if (abilityFresh) {
        const { d20, bonus, checkName } = abilityEvent;
        rollDescription = `${checkName} by ${targetName}: d20(${d20}) + ${bonus} = ${d20 + bonus}`;
    } else {
        const { d20, bonus, saveType } = saveEvent;
        const saveLabel = saveType ? saveType.toUpperCase() : 'Save';
        rollDescription = `${saveLabel} by ${targetName}: d20(${d20}) + ${bonus} = ${d20 + bonus}`;
    }

    const description = `<b>${featureName}</b><br/>Target: ${targetName}<br/>Rolled 1d4: <b>${d4Roll.total}</b><br/>Choose to apply <b>+${d4Roll.total}</b> (bonus) or <b>-${d4Roll.total}</b> (penalty) to the d20 roll.<br/><br/>${rollDescription}`;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} on ${targetName}. Rolled 1d4: ${d4Roll.total}. Applied as bonus/penalty.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[reactionBonus] Error:", e); throw e; });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
        },
    };
}

async function handleAcBonus(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const prof = playerStats.proficiency || 0;

    const activeKey = 'defensiveDuelistActive';
    const wasActive = getRuntimeValue(playerName, activeKey, campaignName) === true;

    if (wasActive) {
        setRuntimeValue(playerName, activeKey, null, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} ended ${action.name}.`,
        }).catch(() => {});
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} ended.`,
                automation: auto,
            },
        };
    }

    setRuntimeValue(playerName, activeKey, true, campaignName);
    setRuntimeValue(playerName, 'defensiveDuelistBonus', prof, campaignName);

    const durationRounds = parseDurationRounds(auto.duration) || 1;
    addExpiration(playerName, playerName, [
        { type: 'defensive_duelist' }
    ], campaignName, durationRounds);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated ${action.name}. Proficiency bonus (+${prof}) added to AC as a Reaction.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name} activated! Add ${prof} (Proficiency Bonus) to AC until the start of your next turn or until used.`,
            automation: auto,
        },
    };
}

async function handleUnbreakableMajesty(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const activeKey = 'unbreakableMajestyActive';
    const wasActive = getRuntimeValue(playerName, activeKey, campaignName) === true;

    if (wasActive) {
        setRuntimeValue(playerName, activeKey, null, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} ended ${action.name}.`,
        }).catch(() => {});
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} ended.`,
                automation: auto,
            },
        };
    }

    const chaBonus = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;
    const prof = playerStats.proficiency || 0;
    const saveDc = 8 + chaBonus + prof;

    setRuntimeValue(playerName, activeKey, true, campaignName);
    setRuntimeValue(playerName, 'unbreakableMajestySaveDc', saveDc, campaignName);

    const durationRounds = parseDurationRounds(auto.duration) || 10;
    addExpiration(playerName, playerName, [
        { type: 'unbreakable_majesty' }
    ], campaignName, durationRounds);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} activated ${action.name}. Attacks against them may miss on a failed CHA save (DC ${saveDc}).`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name} activated. For ${auto.duration || '1 minute'}, the first attack per turn that hits you forces the attacker to make a CHA save (DC ${saveDc}) or the attack misses. Ends if you are Incapacitated.`,
            automation: auto,
        },
    };
}

async function handleLeapAside(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Leap Aside';

    const mountName = getRuntimeValue(playerName, 'mountName', campaignName);
    if (!mountName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires you to be mounted. No mount is currently active.`,
                automation: auto,
            },
        };
    }

    const isNotIncapacitated = !playerStats.conditions?.some(c => {
        const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
        return ['incapacitated'].includes(cStr.toLowerCase());
    });
    if (!isNotIncapacitated) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires you to not be Incapacitated.`,
                automation: auto,
            },
        };
    }

    const mountIsIncapacitated = getRuntimeValue(mountName, 'conditions', campaignName);
    if (mountIsIncapacitated && mountIsIncapacitated.some(c => {
        const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
        return ['incapacitated'].includes(cStr.toLowerCase());
    })) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires your mount to not be Incapacitated.`,
                automation: auto,
            },
        };
    }

    setRuntimeValue(playerName, 'leapAsideActive', true, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated Leap Aside for ${mountName}. Mount takes no damage on Dex save success, half on fail.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[reactionBonus] Error:", e); throw e; });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName} activated for ${mountName}. The mount takes no damage on a successful Dexterity saving throw, and only half damage on a failed save.`,
            automation: auto,
        },
    };
}

async function handleVeer(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Veer';

    const mountName = getRuntimeValue(playerName, 'mountName', campaignName);
    if (!mountName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires you to be mounted. No mount is currently active.`,
                automation: auto,
            },
        };
    }

    const isNotIncapacitated = !playerStats.conditions?.some(c => {
        const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
        return ['incapacitated'].includes(cStr.toLowerCase());
    });
    if (!isNotIncapacitated) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires you to not be Incapacitated.`,
                automation: auto,
            },
        };
    }

    setRuntimeValue(playerName, 'veerActive', true, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} activated Veer for ${mountName}. Attacks hitting the mount can be redirected to you.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[reactionBonus] Error:", e); throw e; });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName} activated for ${mountName}. When an attack hits your mount, you can use your Reaction to force the attack to hit you instead.`,
            automation: auto,
        },
    };
}

async function handleInspiringMovement(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    const usesMax = auto.uses_expression
        ? evaluateUses(auto.uses_expression, playerStats)
        : (auto.usesMax ?? auto.uses ?? 0);

    if (usesMax > 0) {
        const usesKey = auto.resourceKey || 'bardicInspirationUses';
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
                    automation: auto,
                },
            };
        }
        await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
    }

    const allyRangeFt = rangeToFeet(auto.allyRange || '30 ft');
    let allyName = null;

    if (allyRangeFt != null && mapName) {
        const positions = await resolveMapPositions(campaignName, mapName, playerStats.name);
        if (positions?.attackerPos) {
            const targetInfo = await resolveTarget(campaignName, playerStats.name);
            if (targetInfo?.target) {
                const targetName = targetInfo.target.name;
                const targetPlayer = positions.targetPos;
                if (targetPlayer) {
                    const dist = getDistanceFeet(positions.attackerPos, targetPlayer);
                    if (dist != null && dist <= allyRangeFt) {
                        allyName = targetName;
                    }
                }
            }
        }
    }

    const noOAs = !!auto.noOAs;
    if (noOAs) {
        setRuntimeValue(playerStats.name, 'inspiringMovementNoOA', true, campaignName);
        addExpiration(playerStats.name, playerStats.name, [
            { type: 'inspiring_movement_no_oa' }
        ], campaignName, 1);
    }

    if (allyName) {
        setRuntimeValue(allyName, 'inspiringMovementGranted', true, campaignName);
        if (noOAs) {
            setRuntimeValue(allyName, 'inspiringMovementNoOA', true, campaignName);
            addExpiration(playerStats.name, allyName, [
                { type: 'inspiring_movement_no_oa' }
            ], campaignName, 1);
        }
        addExpiration(playerStats.name, allyName, [
            { type: 'inspiring_movement_granted' }
        ], campaignName, 1);
    }

    const selfSpeed = playerStats.speed || 30;
    const halfSpeed = Math.floor(selfSpeed / 2);

    let description = `${action.name}: You move up to ${halfSpeed} ft (half your Speed).`;
    if (allyName) {
        description += ` ${allyName} can also move up to half their Speed using their Reaction.`;
    } else if (allyRangeFt != null) {
        description += ` Select an ally within ${auto.allyRange || '30 ft'} to also move up to half their Speed.`;
    }
    if (noOAs) {
        description += ` This movement does not provoke Opportunity Attacks.`;
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} used ${action.name}.` + (allyName ? ` Ally: ${allyName}.` : ''),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation: auto,
        },
    };
}

function evaluateUses(expression, playerStats) {
    if (!expression) return 0;
    const prof = playerStats.proficiency || 0;
    const level = playerStats.level || 1;
    let expr = expression
        .replace(/proficiency_bonus/g, prof)
        .replace(/level/gi, level);
    try {
        const result = new Function(`"use strict"; return (${expr})`)();
        if (typeof result === 'number' && !isNaN(result)) return result;
    } catch (_e) { /* not a simple expression */ }
    return 0;
}

function parseDurationRounds(duration) {
    if (!duration) return undefined;
    const lower = duration.toLowerCase();
    if (lower.startsWith('1_minute')) return 10;
    const match = lower.match(/(\d+)_round/);
    if (match) return parseInt(match[1], 10);
    return undefined;
}
