import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { spendSorceryPoints, getCurrentSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';
import { executeHandler } from '../../index.js';
import { parseDurationRounds } from '../../../rules/effects/durationParser.js';
import { infoPopup } from '../../common/infoPopup.js';
import storage from '../../../ui/storage.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { findAttackRollAgainstTarget } from '../../common/damageRollback.js';

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

async function handleBendFate(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Bend Fate';

    const featureMaxSP = playerStats.automation?.specialActions?.find(a => a.name === 'Sorcery Points')?.uses || 0;
    const maxSP = featureMaxSP || (getClassFeatures(playerStats)?.maxSorceryPoints || 0);
    const currentSP = getCurrentSorceryPoints(playerName, maxSP);

    if (currentSP < 1) {
        return infoPopup(featureName, `${featureName}: No Sorcery Points available. Requires 1 Sorcery Point.`, auto);
    }

    const cs = await getCombatContext(campaignName);
    const lastAttack = cs?.lastAttack || null;


    if (!lastAttack) {
        return infoPopup(featureName, `${featureName}: No recent D20 test found. Bend Fate can only be used shortly after a creature rolls a d20.`, auto);
    }

    if (lastAttack.targetName === playerName) {
        return infoPopup(featureName, `${featureName} can only be used on another creature, not yourself.`, auto);
    }

    const d4Roll = rollExpression('1d4');
    if (!d4Roll) {
        return infoPopup(featureName, `${featureName}: Roll failed.`, auto);
    }

    const attackerName = lastAttack.attackerName;
    const rollType = lastAttack.rollType || 'attack';
    const isAttack = rollType === 'attack';
    const isSave = rollType === 'save' || (rollType === 'attack' && lastAttack.saveDc != null && lastAttack.saveResult != null);
    const isCheck = rollType === 'check' || rollType === 'skill';

    let eventLabel;
    if (isAttack) {
        eventLabel = `Attack by ${attackerName}`;
    } else if (isCheck) {
        eventLabel = `${lastAttack.checkName || 'Ability check'} by ${attackerName}`;
    } else {
        const saveLabel = lastAttack.saveType ? lastAttack.saveType.toUpperCase() : 'Save';
        eventLabel = `${saveLabel} by ${attackerName}`;
    }

    const originalTotal = (lastAttack.d20 || 0) + (lastAttack.bonus || 0);
    const hitStatus = isAttack && lastAttack.targetAc != null
        ? (originalTotal >= lastAttack.targetAc ? 'Hit' : 'Miss')
        : null;
    const saveStatus = isSave && lastAttack.saveDc != null
        ? (originalTotal >= lastAttack.saveDc ? 'Success' : 'Failure')
        : null;

    return {
        type: 'modal',
        modalName: 'bendFateChoice',
        payload: {
            action,
            playerStats,
            campaignName,
            d4Roll,
            lastAttack,
            attackerName,
            eventLabel,
            hitStatus,
            saveStatus,
            isAttack,
            isSave,
            isCheck,
        },
    };
}

export async function applyD20Modifier(action, playerName, campaignName, diceValue, lastAttack, mode, options) {
    const featureName = options.featureName || 'Modify D20';
    const auto = action.automation;

    const d20 = lastAttack.d20 || 0;
    const bonus = lastAttack.bonus || 0;
    const originalTotal = d20 + bonus;
    const modifier = mode === 'bonus' ? diceValue : -diceValue;
    const newTotal = originalTotal + modifier;

    const cs = await getCombatContext(campaignName);
    const attackerName = lastAttack.attackerName;
    const targetName = lastAttack.targetName;
    const rollType = lastAttack.rollType || 'attack';
    const isAttack = rollType === 'attack';
    const isSave = rollType === 'save' || (rollType === 'attack' && lastAttack.saveDc != null && lastAttack.saveResult != null);
    const isCheck = rollType === 'check' || rollType === 'skill';

    const modifierLabel = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    let outcomeNote = '';
    let conditionsAdded = [];
    let conditionsRemoved = [];

    if (isAttack && cs) {
        const targetAc = lastAttack.targetAc || lastAttack.effectiveAc;
        const oldHit = lastAttack.hit ?? (targetAc != null ? originalTotal >= targetAc : null);
        const newHit = targetAc != null ? newTotal >= targetAc : null;

        cs.lastAttack = {
            ...cs.lastAttack,
            total: newTotal,
            hit: newHit,
            bendFateApplied: true,
            bendFateModifier: modifier,
            bendFateD4: diceValue,
            bendFateMode: mode,
            timestamp: Date.now(),
        };
        storage.set('combatSummary', cs, campaignName);

        if (oldHit && !newHit) {
            outcomeNote = ' → The attack now misses!';
            const rawDamage = lastAttack.primaryDamage || lastAttack.rawDamage || 0;
            if (rawDamage > 0) {
                const healResult = applyHealingToTarget(cs, targetName, rawDamage, campaignName);
                if (healResult) {
                    outcomeNote += ` Undid ${healResult.actualHeal} damage.`;
                }
            }
        } else if (!oldHit && newHit) {
            outcomeNote = ' → The attack now hits!';
            const damageFormula = lastAttack.damageFormula;
            if (damageFormula) {
                const dmgResult = rollExpression(damageFormula);
                if (dmgResult && dmgResult.total > 0) {
                    const characters = [action._playerStats || { name: playerName }];
                    const appliedDmg = applyDamageToTarget(cs, targetName, dmgResult.total, [lastAttack.damageType || 'unknown'], campaignName, characters, false, attackerName);
                    if (appliedDmg) {
                        outcomeNote += ` Rolled ${appliedDmg.finalDamage} damage.`;
                    }
                }
            }
        } else if (oldHit && newHit) {
            outcomeNote = ' → The attack still hits.';
        } else if (oldHit !== null && newHit !== null) {
            outcomeNote = ' → The attack still misses.';
        } else {
            outcomeNote = ' → No change in outcome.';
        }
    } else if (isSave && cs) {
        const saveDc = lastAttack.saveDc;
        const oldSuccess = (originalTotal >= saveDc);
        const newSuccess = (newTotal >= saveDc);

        cs.lastAttack = {
            ...cs.lastAttack,
            total: newTotal,
            saveResult: newSuccess ? 'success' : 'failure',
            bendFateApplied: true,
            bendFateModifier: modifier,
            bendFateD4: diceValue,
            bendFateMode: mode,
            timestamp: Date.now(),
        };
        storage.set('combatSummary', cs, campaignName);

        if (oldSuccess && !newSuccess) {
            outcomeNote = ' → The save now fails!';
            const saveConditions = lastAttack.saveConditions || [];
            for (const condKey of saveConditions) {
                const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
                const filtered = conditions.filter(c => String(c).toLowerCase() !== String(condKey).toLowerCase());
                setRuntimeValue(targetName, 'activeConditions', [...filtered, condKey], campaignName);
                conditionsAdded.push(condKey);
            }
        } else if (!oldSuccess && newSuccess) {
            outcomeNote = ' → The save now succeeds!';
            const saveConditions = lastAttack.saveConditions || [];
            for (const condKey of saveConditions) {
                const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
                const filtered = conditions.filter(c => String(c).toLowerCase() !== String(condKey).toLowerCase());
                setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
                conditionsRemoved.push(condKey);
            }
        } else if (oldSuccess && newSuccess) {
            outcomeNote = ' → The save still succeeds.';
        } else {
            outcomeNote = ' → The save still fails.';
        }
    } else if (isCheck) {
        cs.lastAttack = {
            ...cs.lastAttack,
            total: newTotal,
            bendFateApplied: true,
            bendFateModifier: modifier,
            bendFateD4: diceValue,
            bendFateMode: mode,
            timestamp: Date.now(),
        };
        storage.set('combatSummary', cs, campaignName);
        outcomeNote = ` New total: ${newTotal}.`;
    }

    if (options.onSpent) {
        options.onSpent();
    }

    const logConditions = (arr, verb) => {
        if (arr.length === 0) return '';
        return ` ${verb}: ${arr.join(', ')}.`;
    };

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} on ${attackerName}. Dice: ${diceValue}. Applied as ${mode}. ${attackerName}'s roll: d20(${d20}) + ${bonus} = ${originalTotal} → ${newTotal}. Outcome: ${outcomeNote.replace(' → ', '')}.${logConditions(conditionsAdded, 'Added')}${logConditions(conditionsRemoved, 'Removed')}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error(`[${featureName}] Error:`, e); });

    let description = `Target: ${attackerName}<br/>`;
    description += `Rolled <b>${diceValue}</b><br/>`;
    description += `Applied as <b>${mode}</b>: <b>${modifierLabel}</b><br/><br/>`;

    if (isAttack) {
        const ac = lastAttack.targetAc || lastAttack.effectiveAc || '—';
        const hitStatus = (newTotal >= (lastAttack.targetAc || lastAttack.effectiveAc)) ? 'HIT' : 'MISS';
        description += `Attack: d20(${d20}) + ${bonus}${modifierLabel} = <strong>${newTotal}</strong> vs AC ${ac} → ${hitStatus}${outcomeNote}`;
        if (lastAttack.targetAc == null && lastAttack.effectiveAc == null && lastAttack.hit) {
            description += ` (Original was a hit)`;
        }
    } else if (isSave) {
        const saveLabel = lastAttack.saveType ? lastAttack.saveType.toUpperCase() : 'Save';
        const dc = lastAttack.saveDc || '—';
        const saveStatus = (newTotal >= (lastAttack.saveDc || 0)) ? 'Success' : 'Failure';
        description += `${saveLabel}: d20(${d20}) + ${bonus}${modifierLabel} = <strong>${newTotal}</strong> vs DC ${dc} → ${saveStatus}${outcomeNote}`;
        if (conditionsAdded.length > 0) {
            description += `<br/><i>Conditions applied: ${conditionsAdded.join(', ')}</i>`;
        }
        if (conditionsRemoved.length > 0) {
            description += `<br/><i>Conditions removed: ${conditionsRemoved.join(', ')}</i>`;
        }
    } else {
        description += `${lastAttack.checkName || 'Check'}: d20(${d20}) + ${bonus}${modifierLabel} = <strong>${newTotal}</strong>${outcomeNote}`;
    }

    return infoPopup(featureName, description, auto);
}

export async function applyBendFateChoice(action, playerStats, campaignName, d4Roll, lastAttack, mode) {
    const playerName = playerStats.name;
    const d4Value = typeof d4Roll === 'object' ? d4Roll.total : d4Roll;
    action._playerStats = playerStats;
    return applyD20Modifier(action, playerName, campaignName, d4Value, lastAttack, mode, {
        featureName: action.name || 'Bend Fate',
        logDescription: `${playerName} used ${action.name || 'Bend Fate'}`,
        onSpent: () => spendSorceryPoints(playerName, 1, campaignName),
    });
}

async function handleAcBonus(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const buffName = action.name;
    const prof = playerStats.proficiency || 0;

    // Check for Finesse weapon in equipped items
    const equipped = playerStats.inventory?.equipped || [];
    let hasFinesse = false;
    for (const itemName of equipped) {
        if (!itemName || typeof itemName !== 'string') continue;
        const baseName = itemName.charAt(0) === '+' ? itemName.substring(3) : itemName;
        const item = playerStats.equipment?.find(e => e.name === baseName);
        if (item) {
            const properties = item.properties || [];
            if (properties.some(p => p.toLowerCase() === 'finesse')) {
                hasFinesse = true;
                break;
            }
        }
    }
    if (!hasFinesse) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: buffName, description: `You must be wielding a Finesse weapon to use ${buffName}.`, automation: auto },
        };
    }

    // Check lastAttack — was the player the target?
    const attackResult = await findAttackRollAgainstTarget(playerName, campaignName);

    if (!attackResult.attackEvent) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: buffName, description: `No recent attack targeting ${playerName} to react to.`, automation: auto },
        };
    }

    // Toggle buff
    const { wasActive } = toggleBuff(playerName, buffName, { ...auto, effect: 'defensive_duelist', acBonus: prof }, campaignName);

    if (wasActive) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: buffName, description: `${buffName} is already active.`, automation: auto },
        };
    }

    // Set expiration — auto-removes at start of next turn
    addExpiration(playerName, playerName, [
        { type: 'remove_active_buff', buffName }
    ], campaignName, undefined, playerName);

    // Check if hit would become miss
    const { d20, bonus, targetAc, rawDamage, attackerName } = attackResult.attackEvent;
    const rollTotal = d20 + bonus;
    const newAc = targetAc != null ? targetAc + prof : null;
    const wouldMiss = targetAc != null && (rollTotal < newAc);

    let description = `${buffName} activated — +${prof} AC until start of your next turn.`;
    let healAmount = 0;

    if (wouldMiss && attackerName && rawDamage > 0) {
        const cs = await getCombatContext(campaignName);
        if (cs) {
            const healResult = applyHealingToTarget(cs, playerName, rawDamage, campaignName);
            if (healResult?.actualHeal != null) {
                healAmount = healResult.actualHeal;
            }
        }
        if (healAmount > 0) {
            description += ` The attack misses! (Roll ${rollTotal} < AC ${newAc}) — ${healAmount} HP healed.`;
        } else {
            description += ` The attack misses! (Roll ${rollTotal} < AC ${newAc})`;
        }
    } else if (wouldMiss) {
        description += ` The attack misses! (Roll ${rollTotal} < AC ${newAc})`;
    } else {
        description += ` The attack still hits. (Roll ${rollTotal} >= AC ${newAc})`;
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: buffName,
        description,
    }).catch((e) => { console.error(`[${buffName}] Error:`, e); });

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: buffName, description, automation: auto },
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
    }).catch((e) => { console.error("[reactionBonus] Error:", e); });

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
    }).catch((e) => { console.error("[reactionBonus] Error:", e); });

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

async function handleInspiringMovement(action, playerStats, campaignName, _mapName) {
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
    }

    const selfSpeed = playerStats.speed || 30;
    const halfSpeed = Math.floor(selfSpeed / 2);

    const combatSummary = await getCombatContext(campaignName);
    const creatureTargets = combatSummary?.creatures
        ?.filter(c => c.name !== playerStats.name)
        .map(c => ({ name: c.name, currentHp: c.currentHp, maxHp: c.maxHp, size: c.size, type: c.type })) || [];

    if (creatureTargets.length === 0) {
        const noOAs = !!auto.noOAs;
        let description = `${action.name}: You may move up to ${halfSpeed} ft (half your Speed) as a Reaction.`;
        if (noOAs) {
            description += ` This movement does not provoke Opportunity Attacks.`;
        }
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

    return {
        type: 'modal',
        modalName: 'inspiringMovementAlly',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            halfSpeed,
            noOAs: !!auto.noOAs,
            allyRange: auto.allyRange || '30 ft',
            usesMax,
            usesKey: auto.resourceKey || 'bardicInspirationUses',
        },
    };
}

export async function applyInspiringMovement(action, playerStats, campaignName, allyName, halfSpeed, noOAs) {
    const auto = action.automation;
    const usesMax = auto.uses_expression
        ? evaluateUses(auto.uses_expression, playerStats)
        : (auto.usesMax ?? auto.uses ?? 0);

    if (usesMax > 0) {
        const usesKey = auto.resourceKey || 'bardicInspirationUses';
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);
        await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
    }

    setRuntimeValue(playerStats.name, 'inspiringMovementNoOA', true, campaignName);
    addExpiration(playerStats.name, playerStats.name, [
        { type: 'inspiring_movement_no_oa' }
    ], campaignName, undefined, playerStats.name);

    if (allyName) {
        setRuntimeValue(allyName, 'inspiringMovementGranted', true, campaignName);
        if (noOAs) {
            setRuntimeValue(allyName, 'inspiringMovementNoOA', true, campaignName);
            addExpiration(playerStats.name, allyName, [
                { type: 'inspiring_movement_no_oa' }
            ], campaignName, undefined, playerStats.name);
        }
        addExpiration(playerStats.name, allyName, [
            { type: 'inspiring_movement_granted' }
        ], campaignName, undefined, playerStats.name);
    }

    let description = `${playerStats.name} used ${action.name} (Dance). `;
    description += `You move up to ${halfSpeed} ft (half your Speed) as a Reaction. `;
    if (allyName) {
        description += `${allyName} can also move up to half their Speed using their Reaction. `;
    }
    if (noOAs) {
        description += `This movement does not provoke Opportunity Attacks.`;
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} used ${action.name}.` + (allyName ? ` Ally: ${allyName}. Movement does not provoke Opportunity Attacks.` : ' Movement does not provoke Opportunity Attacks.'),
    }).catch(() => {});

    const hasAgileStrikes = (playerStats.automation?.passives || []).some(
        p => p.type === 'passive_rule' && p.effect === 'agile_strike'
    );

    if (hasAgileStrikes) {
        const classLevel = (playerStats.class?.class_levels ?? []).find(cl => cl.level === playerStats.level);
        const bardicDie = classLevel?.bardic_die || 6;
        const agileStrikeAction = {
            name: 'Agile Strikes',
            automation: {
                type: 'agile_strike',
                bardicDie: bardicDie,
            },
        };
        const strikeResult = await executeHandler(agileStrikeAction, playerStats, campaignName, null);
        if (strikeResult && strikeResult.type === 'popup') {
            return strikeResult;
        }
    }

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


