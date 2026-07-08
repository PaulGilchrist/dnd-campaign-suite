import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../../../services/encounters/combatData.js';
import { loadManeuvers } from '../../../ui/dataLoader.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

function applyConditionToTarget(targetName, conditionKey, campaignName, combatSummary) {
    if (!combatSummary) return;
    const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const existing = conditions.find(c => String(c).toLowerCase() === conditionKey.toLowerCase());
    if (existing) return;
    setRuntimeValue(targetName, 'activeConditions', [...conditions, conditionKey], campaignName);
}

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

function computeMaxOptions(playerStats, auto) {
    const base = auto.maxOptions || 3;
    const scaling = auto.maxOptionsScaling || {};
    let total = base;
    const level = playerStats.level || 0;
    const sortedLevels = Object.keys(scaling)
        .map(Number)
        .filter(l => !isNaN(l))
        .sort((a, b) => a - b);
    for (const scaleLevel of sortedLevels) {
        if (level >= scaleLevel) {
            total += scaling[scaleLevel];
        }
    }
    return total;
}

function getKnownManeuvers(playerStats, campaignName) {
    const stored = getRuntimeValue(playerStats.name, SELECTION_KEY, campaignName);
    return Array.isArray(stored) ? stored : [];
}

function hasRelentless(playerStats) {
    return (playerStats.automation?.passives || []).some(p => p.type === 'passive_rule' && p.effect === 'relentless');
}

function getRelentlessUsedRound(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, 'relentlessUsedRound', campaignName);
}

function setRelentlessUsed(playerStats, campaignName) {
    const currentRound = getCurrentCombatRound();
    setRuntimeValue(playerStats.name, 'relentlessUsedRound', currentRound, campaignName);
}

export function getSuperiorityDice(playerStats, campaignName) {
    const usesKey = 'superiorityDice';
    const defaultMax = 4;
    return Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? defaultMax);
}

async function validateSizeLimit(maneuver, targetName, campaignName, playerStats) {
    if (!maneuver.sizeLimit || !targetName) return { valid: true };
    const sizeOrder = ['Fine', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
    let maxAllowed;
    if (maneuver.sizeLimit === 'large_or_smaller') {
        maxAllowed = sizeOrder.indexOf('Large');
    }
    else if (maneuver.sizeLimit === 'medium_or_smaller') {
        maxAllowed = sizeOrder.indexOf('Medium');
    }
    else if (maneuver.sizeLimit === 'one_size_larger') {
        maxAllowed = sizeOrder.indexOf(playerStats?.size || 'Medium') + 1;
    }
    if (maxAllowed == null) return { valid: true };
    const cs = await getCombatContext(campaignName);
    if (!cs) return { valid: true };
    const target = cs.creatures?.find(c => c.name === targetName);
    if (!target) return { valid: true };
    const targetSizeIndex = sizeOrder.indexOf(target.size || 'Medium');
    if (targetSizeIndex > maxAllowed) {
        const sizeLabel = maneuver.sizeLimit === 'large_or_smaller'
            ? 'Large or smaller'
            : maneuver.sizeLimit === 'medium_or_smaller'
                ? 'Medium or smaller'
                : `up to one size larger than you`;
        return {
            valid: false,
            description: `${maneuver.name}: Target is ${target.size} (too large — only ${sizeLabel} affected).`,
        };
    }
    return { valid: true };
}

export function getAvailableAttackRiderManeuvers(playerStats, campaignName, attackInfo) {
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) return [];

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) return [];

    return getManeuversByType(playerStats, campaignName, knownNames, 'attack_rider', attackInfo);
}

export function getAvailableAttackRiderManeuversByTrigger(playerStats, campaignName, attackInfo) {
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) return [];

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) return [];

    const allManeuvers = getManeuversByType(playerStats, campaignName, knownNames, 'attack_rider', attackInfo);

    const isWeaponAttack = attackInfo?.weaponType === 'melee' || attackInfo?.weaponType === 'ranged' || attackInfo?.isUnarmedStrike;
    const isMeleeAttack = attackInfo?.weaponType === 'melee' || attackInfo?.isUnarmedStrike;

    return allManeuvers.filter(m => {
        if (!m.trigger || m.trigger === 'any') return true;
        if (m.trigger === 'weapon_attack_hit') {
            return isWeaponAttack;
        }
        if (m.trigger === 'melee_weapon_attack_hit') {
            return isMeleeAttack;
        }
        if (m.trigger === 'attack_roll_miss') {
            return attackInfo?.hit === false;
        }
        if (m.trigger === 'melee_attack_miss') {
            return isMeleeAttack && attackInfo?.hit === false;
        }
        if (m.trigger === 'melee_damage_taken') {
            return isMeleeAttack;
        }
        if (m.trigger === 'melee_attack_straight_line') {
            return isMeleeAttack;
        }
        if (m.trigger === 'replace_attack') {
            return attackInfo?.replacingAttack === true;
        }
        return true;
    });
}

export function getAvailableSkillCheckManeuvers(playerStats, campaignName, skillName, isInitiative) {
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) return [];

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) return [];

    const allManeuvers = allManeuversCache.get(`${playerStats.rules || '2024'}`) || [];

    return allManeuvers.filter(m => {
        if (!knownNames.includes(m.name)) return false;
        if (m.actionType !== 'skill_check') return false;
        if (m.initiativeBonus && isInitiative) return true;
        if (m.skills && m.skills.length > 0) {
            const skillLower = skillName?.toLowerCase() || '';
            return m.skills.some(s => s.toLowerCase().includes(skillLower) || skillLower.includes(s.toLowerCase()));
        }
        return false;
    });
}

export function getSkillCheckManeuversForSkill(playerStats, campaignName, skillName, isInitiative) {
    const maneuvers = getAvailableSkillCheckManeuvers(playerStats, campaignName, skillName, isInitiative);
    return maneuvers.map(m => ({
        name: m.name,
        dieExpression: m.dieExpression || 'superiority_die',
        skills: m.skills || [],
        isInitiative: !!m.initiativeBonus,
    }));
}

export async function handleAttackRiderPrompt(action, playerStats, campaignName, _mapName) {
    const pending = getRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', campaignName);
    if (!pending || !pending.attackContext) { return null; }

    const attackContext = pending.attackContext;
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) {
        setRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', null, campaignName);
        return null;
    }

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) {
        setRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', null, campaignName);
        return null;
    }

    await getManeuversForRules(playerStats.rules || '2024');

    const available = getAvailableAttackRiderManeuversByTrigger(playerStats, campaignName, attackContext);
    if (available.length === 0) {
        setRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', null, campaignName);
        return null;
    }

    return {
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: {
            action: {
                automation: {
                    type: 'combat_superiority',
                    dieExpression: 'superiority_die',
                },
            },
            playerStats,
            campaignName,
            knownManeuvers: available.map(m => m.name),
            availableManeuvers: available,
            maxOptions: available.length,
            selectionMode: false,
            attackContext,
            saveDc: attackContext?.saveDc || null,
            saveType: attackContext?.saveType || null,
        },
    };
}

export async function handleSkillCheckPrompt(action, playerStats, campaignName, _mapName) {
    const pending = getRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', campaignName);
    if (!pending || !pending.skillContext) return null;

    const skillContext = pending.skillContext;
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) return null;

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) return null;

    await getManeuversForRules(playerStats.rules || '2024');

    const available = getAvailableSkillCheckManeuvers(playerStats, campaignName, skillContext?.skillName, skillContext?.isInitiative);
    if (available.length === 0) return null;

    return {
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: {
            action: {
                automation: {
                    type: 'combat_superiority',
                    dieExpression: 'superiority_die',
                },
            },
            playerStats,
            campaignName,
            knownManeuvers: available.map(m => m.name),
            availableManeuvers: available,
            maxOptions: available.length,
            selectionMode: false,
            skillContext,
            saveDc: null,
            saveType: null,
        },
    };
}

function getManeuversByType(playerStats, campaignName, knownNames, actionType, attackInfo) {
    const allManeuvers = allManeuversCache.get(`${playerStats.rules || '2024'}`) || [];
    return allManeuvers.filter(m => {
        if (!knownNames.includes(m.name)) return false;
        if (actionType && m.actionType !== actionType) return false;
        if (attackInfo && m.trigger && m.trigger !== 'any') {
            const isWeaponAttack = attackInfo.weaponType === 'melee' || attackInfo.weaponType === 'ranged' || attackInfo.isUnarmedStrike;
            const isMeleeAttack = attackInfo.weaponType === 'melee' || attackInfo.isUnarmedStrike;
            if (m.trigger === 'weapon_attack_hit' && !isWeaponAttack) return false;
            if (m.trigger === 'melee_weapon_attack_hit' && !isMeleeAttack) return false;
        }
        return true;
    });
}

const allManeuversCache = new Map();

export async function getManeuversForRules(rules) {
    const key = rules || '2024';
    if (!allManeuversCache.has(key)) {
        const maneuvers = await loadManeuvers(key);
        allManeuversCache.set(key, maneuvers);
    }
    return allManeuversCache.get(key);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const forceSelectionMode = auto?.forceSelectionMode === true;
    const knownManeuvers = getKnownManeuvers(playerStats, campaignName);
    const allManeuvers = await loadManeuvers(playerStats.rules || '2024');

    if (!allManeuvers.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver data available.',
                automation: auto,
            },
            logEntries: [],
        };
    }

    const maxOptions = computeMaxOptions(playerStats, auto);

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;
    if (superiorityDice <= 0 && !(relentless && !relentlessUsed)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No Superiority Dice remaining. Recharges on a Short or Long Rest.',
                automation: auto,
            },
        };
    }

    const unknownManeuvers = allManeuvers.filter(m => !knownManeuvers.includes(m.name));
    const known = allManeuvers.filter(m => knownManeuvers.includes(m.name));

    const needsSelection = forceSelectionMode || (known.length < maxOptions && unknownManeuvers.length > 0);

    const nonAttackRiderKnown = known.filter(m => m.actionType !== 'attack_rider' && m.actionType !== 'skill_check');
    const hasNonAttackRiderManeuvers = nonAttackRiderKnown.length > 0;

    const cs = await getCombatContext(campaignName);
    const lastAttack = cs?.lastAttack || null;

    const modalPayload = {
        action,
        playerStats,
        campaignName,
        allManeuvers,
        knownManeuvers: known.map(m => m.name),
        maxOptions,
        selectionMode: needsSelection || (!hasNonAttackRiderManeuvers && !needsSelection),
        saveDc: auto.saveDc,
        saveType: auto.saveType || 'WIS',
        dieExpression: auto.dieExpression || 'superiority_die',
        lastAttack,
    };

    return {
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: modalPayload,
    };
}

export async function onCombatSuperioritySelected(action, playerStats, campaignName, selectedManeuverNames, singleUseManeuverName) {
    const auto = action.automation;

    if (Array.isArray(selectedManeuverNames)) {
        const allManeuvers = await loadManeuvers(playerStats.rules || '2024');

        if (selectedManeuverNames.length === 0) {
            await setRuntimeValue(playerStats.name, SELECTION_KEY, [], campaignName);
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: 'Combat Superiority selection cleared.',
                    automation: auto,
                },
            };
        }

        const validNames = selectedManeuverNames.filter(n =>
            allManeuvers.some(m => m.name === n)
        );

        await setRuntimeValue(playerStats.name, SELECTION_KEY, validNames, campaignName);

        const namesHtml = validNames.map(n => `<b>${n}</b>`).join(', ');
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Maneuvers selected: ${namesHtml}. You can now use these by using Combat Superiority during combat.`,
                automation: auto,
            },
        };
    }

    if (singleUseManeuverName) {
        return executeManeuver(action, playerStats, campaignName, singleUseManeuverName);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: 'No maneuver selected.',
            automation: auto,
        },
    };
}

export async function getAttackRiderOptions(playerStats, campaignName, attackInfo) {
    return getAttackRiderOptionsByContext(playerStats, campaignName, attackInfo, 'hit');
}

export async function getAttackRiderOptionsByContext(playerStats, campaignName, attackInfo, context) {
    const knownNames = getKnownManeuvers(playerStats, campaignName);
    if (knownNames.length === 0) return [];

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    if (superiorityDice <= 0) return [];

    const allManeuvers = await getManeuversForRules(playerStats.rules);
    const knownManeuvers = allManeuvers.filter(m => knownNames.includes(m.name) && m.actionType === 'attack_rider');

    if (knownManeuvers.length === 0) return [];

    const isWeaponAttack = attackInfo?.weaponType === 'melee' || attackInfo?.weaponType === 'ranged' || attackInfo?.isUnarmedStrike;
    const isMeleeAttack = attackInfo?.weaponType === 'melee' || attackInfo?.isUnarmedStrike;

    const available = knownManeuvers.filter(m => {
        if (!m.trigger) return true;
        if (m.trigger === 'attack_roll_miss') {
            return context === 'miss';
        }
        if (m.trigger === 'weapon_attack_hit') return isWeaponAttack;
        if (m.trigger === 'melee_weapon_attack_hit') return isMeleeAttack;
        return true;
    });

    return available.map(m => ({
        name: m.name,
        effect: m.effect,
        damageBonus: m.damageBonus || false,
        saveType: m.saveType || null,
        saveAbility: m.saveAbility || null,
        conditionInflicted: m.conditionInflicted || null,
        value: m.value || null,
        range: m.range || null,
        dieExpression: m.dieExpression || 'superiority_die',
    }));
}

export function rollManeuverDie(maneuver, playerStats, campaignName) {
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    const superiorityDieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = relentlessRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue}.`;
    }

    return { dieValue, dieDescription, expendedDie, relentlessUsed };
}

export async function executeAttackRiderManeuver(action, playerStats, campaignName, maneuverName, attackInfo) {
    const allManeuvers = await getManeuversForRules(playerStats.rules);
    const maneuver = allManeuvers.find(m => m.name === maneuverName);

    if (!maneuver) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuverName,
                description: `Maneuver "${maneuverName}" not found.`,
            },
        };
    }

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    if (superiorityDice <= 0 && !(relentless && !relentlessUsed)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
            },
        };
    }

    const { dieValue, dieDescription, expendedDie } = rollManeuverDie(maneuver, playerStats, campaignName);

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || attackInfo?.targetName || null;

    if (targetName && maneuver.sizeLimit) {
        const sizeCheck = await validateSizeLimit(maneuver, targetName, campaignName, playerStats);
        if (!sizeCheck.valid) {
            await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice, campaignName);
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: maneuver.name,
                    description: sizeCheck.description,
                },
            };
        }
    }

    let description = dieDescription;

    if (targetName) {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.damageBonus) {
        description += ` Added ${dieValue} to the damage roll.`;
        if (targetName) {
            const damageType = attackInfo?.damageType || 'force';
            const combatSummary = await getCombatContext(campaignName);
            if (combatSummary) {
                const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
                const result = applyDamageToTarget(combatSummary, targetName, dieValue, [damageType], campaignName, characters, false, playerStats.name);
                if (result.finalDamage > 0) {
                    description += ` Dealt ${result.finalDamage} damage to ${targetName}.`;
                }
            }
        }
    }

    if (maneuver.saveType && targetName) {
        const saveDc = buildSaveDc(action?.automation || {}, playerStats);
        const { promise } = createSaveListener(campaignName, {
            targetName,
            saveType: maneuver.saveType,
            saveDc,
        });

        const saveResult = await promise;
        const success = saveResult.success;

        description += ` Target made ${maneuver.saveType} save DC ${saveDc}: ${success ? 'Success' : 'Failure'}.`;

        if (!success) {
            if (maneuver.effect === 'frightened') {
                description += ` ${targetName} is Frightened until the end of your next turn.`;
                const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
                const conditions = Array.isArray(storedConditions) ? storedConditions : [];
                const hasFrightened = conditions.some(c => String(c).toLowerCase() === 'frightened');
                if (!hasFrightened) {
                    await setRuntimeValue(targetName, 'activeConditions', [...conditions, 'frightened'], campaignName);
                }
                const cs = await getCombatContext(campaignName);
                applyConditionToTarget(targetName, 'frightened', campaignName, cs);
                await addExpiration(playerStats.name, targetName, [
                    { type: 'condition', condition: 'frightened' },
                ], campaignName, 2);
            } else if (maneuver.effect === 'disarm') {
                description += ` ${targetName} dropped the object it was holding.`;
            } else if (maneuver.effect === 'push') {
                const pushDistance = maneuver.value || 15;
                description += ` ${targetName} was pushed ${pushDistance} feet away.`;
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const newEffect = {
                    target: targetName,
                    source: maneuver.name,
                    option: maneuver.name,
                    effect: 'push',
                    value: pushDistance,
                    duration: 'instant',
                    saveType: maneuver.saveType,
                    saveDc,
                    saveAbility: maneuver.saveAbility,
                };
                const updatedEffects = [...storedEffects, newEffect];
                setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
            } else if (maneuver.effect === 'goad') {
                description += ` ${targetName} has Disadvantage on attacks against targets other than you.`;
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const newEffect = {
                    target: targetName,
                    source: playerStats.name,
                    effect: 'goad',
                    duration: 'until_end_of_user_next_turn',
                };
                const updatedEffects = [...storedEffects, newEffect];
                setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
            } else if (maneuver.effect === 'prone') {
                description += ` ${targetName} fell Prone.`;
                const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
                const conditions = Array.isArray(storedConditions) ? storedConditions : [];
                const hasProne = conditions.some(c => String(c).toLowerCase() === 'prone');
                if (!hasProne) {
                    await setRuntimeValue(targetName, 'activeConditions', [...conditions, 'prone'], campaignName);
                }
                const cs = await getCombatContext(campaignName);
                applyConditionToTarget(targetName, 'prone', campaignName, cs);
            } else if (maneuver.conditionInflicted) {
                description += ` ${targetName} gained the ${maneuver.conditionInflicted} condition.`;
            } else {
                description += ` The effect was applied to ${targetName}.`;
            }
        }
    } else if (maneuver.saveType) {
        const saveDc = buildSaveDc(action?.automation || {}, playerStats);
        description += ` Target must make a ${maneuver.saveType} save DC ${saveDc}`;
        if (maneuver.conditionInflicted) {
            description += ` or gain ${maneuver.conditionInflicted} condition`;
        } else if (maneuver.effect === 'disarm') {
            description += ` or drop one object it's holding`;
        } else if (maneuver.effect === 'push') {
            description += ` or be pushed ${maneuver.value || 15} feet away`;
        } else if (maneuver.effect === 'goad') {
            description += ` or have Disadvantage on attacks against targets other than you`;
        } else if (maneuver.effect === 'prone') {
            description += ` or fall Prone`;
        } else {
            description += ` or suffer the effect`;
        }
        description += '.';
    }

    if (maneuver.effect === 'next_attack_advantage' || maneuver.effect === 'distracting_strike_advantage') {
        description += ` The next attack against ${targetName || 'the target'} by an ally has Advantage.`;
        if (targetName) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const newEffect = {
                target: targetName,
                source: playerStats.name,
                effect: 'distracting_strike_advantage',
                value: null,
                duration: 'until_end_of_turn',
            };
            await setRuntimeValue(campaignName, 'targetEffects', [...storedEffects, newEffect], campaignName);
        }
    }

    if (maneuver.effect === 'ally_movement') {
        description += ` An ally can use its Reaction to move up to half its Speed without provoking Opportunity Attacks.`;
    }

    if (maneuver.actionType === 'grant_attack') {
        description += ` An ally can use its Reaction to make an attack, adding ${dieValue} to the damage roll.`;
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description,
    };

    if (maneuver.effect === 'secondary_damage') {
        const cs = await getCombatContext(campaignName);
        if (cs && cs.creatures && targetName) {
            const targetIndex = cs.creatures.findIndex(c => c.name === targetName);
            let secondaryTargets = [];

            if (targetIndex >= 0 && cs.creatures[targetIndex]?.position) {
                const rangeFt = rangeToFeet(maneuver.range || '8_ft') || 8;
                secondaryTargets = cs.creatures
                    .filter((c, i) => i !== targetIndex && c.position)
                    .map(c => ({
                        creature: c,
                        distance: getDistanceFeet(cs.creatures[targetIndex].position, c.position),
                    }))
                    .filter(t => t.distance != null && t.distance <= rangeFt)
                    .map(t => t.creature);

                if (secondaryTargets.length === 0) {
                    description += ` No valid secondary targets within 5 feet of ${targetName}.`;
                }
            } else if (targetIndex >= 0) {
                secondaryTargets = cs.creatures.filter((c, i) => i !== targetIndex);
            }

            if (secondaryTargets.length > 0) {
                setRuntimeValue(playerStats.name, 'pendingSweepingAttack', {
                    dieValue,
                    damageType: attackInfo?.damageType || 'bludgeoning',
                    weaponType: attackInfo?.weaponType || 'melee',
                    isUnarmedStrike: attackInfo?.isUnarmedStrike || false,
                    targetName,
                    secondaryTargets,
                    primaryTargetPos: targetIndex >= 0 ? cs.creatures[targetIndex]?.position : null,
                }, campaignName);

                return {
                    type: 'modal',
                    modalName: 'sweepingAttackTarget',
                    payload: {
                        playerStats,
                        campaignName,
                        secondaryTargets,
                        primaryTarget: targetName,
                        dieValue,
                    },
                    logEntries: [logEntry],
                };
            }
        }
        description += ` A second creature within 5 feet of the target takes ${dieValue} damage (same type as the original attack).`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}

export async function executeBonusActionManeuver(action, playerStats, campaignName, maneuverName) {
    const allManeuvers = await getManeuversForRules(playerStats.rules);
    const maneuver = allManeuvers.find(m => m.name === maneuverName);

    if (!maneuver) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuverName,
                description: `Maneuver "${maneuverName}" not found.`,
            },
        };
    }

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    if (superiorityDice <= 0 && !(relentless && !relentlessUsed)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
            },
        };
    }

    const superiorityDieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || null;

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = relentlessRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name} as a bonus action. ${dieDescription} ${maneuver.description}`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    let description = `<b>${maneuver.name}</b> (Bonus Action)<br/>${dieDescription}`;

    if (targetName && maneuver.effect !== 'ac_bonus_disengage' && maneuver.effect !== 'dash_and_damage') {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.saveType) {
        description += ` Target must make a ${maneuver.saveType} save or suffer the effect.`;
    }

    if (maneuver.effect === 'temp_hp') {
        const fighterLevel = playerStats.level || 1;
        const extraHpRaw = maneuver.extraHpExpression
            ? evaluateAutoExpression(maneuver.extraHpExpression, playerStats)
            : Math.floor(fighterLevel / 2);
        const extraHp = typeof extraHpRaw === 'number' ? Math.floor(extraHpRaw) : Math.floor(fighterLevel / 2);
        const totalHp = dieValue + extraHp;
        const cs = await getCombatContext(campaignName);
        const allies = cs?.creatures?.filter(c => c.name !== playerStats.name) || [];
        if (allies.length === 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: maneuver.name,
                    description: `${maneuver.name}: No allies available to receive Rally.`,
                },
            };
        }
        const allyOptions = allies.map(a => ({ label: a.name, value: a.name }));
        const logEntry = {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: maneuver.name,
            description: `${maneuver.name}: Choose an ally to gain temporary hit points.`,
        };
        return {
            type: 'modal',
            modalName: 'rallyChoice',
            payload: {
                playerStats,
                campaignName,
                dieValue,
                maneuverName: maneuver.name,
                allyOptions,
                totalHp,
                extraHp,
                description,
            },
            logEntries: [logEntry],
        };
    }

    if (maneuver.effect === 'ac_bonus_disengage') {
        description += ` You take the Disengage action and gain +${dieValue} AC until the start of your next turn.`;
        await setRuntimeValue(playerStats.name, 'baitAndSwitchActive', true, campaignName);
        await setRuntimeValue(playerStats.name, 'baitAndSwitchBonus', dieValue, campaignName);
        await setRuntimeValue(playerStats.name, 'baitAndSwitchSource', maneuver.name, campaignName);
        await addExpiration(playerStats.name, playerStats.name, [
            { type: 'bait_and_switch_clear' }
        ], campaignName, undefined, playerStats.name);
    }

    if (maneuver.effect === 'advantage_and_damage') {
        await setRuntimeValue(playerStats.name, 'feintingAttackDieValue', dieValue, campaignName);
        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const currentRound = getCurrentCombatRound();
        const newEffect = {
            target: playerStats.name,
            source: maneuver.name,
            effect: 'next_attack_advantage',
            vexTarget: targetName || null,
            value: null,
            duration: 'until_end_of_turn',
            appliedRound: currentRound,
        };
        await setRuntimeValue(campaignName, 'targetEffects', [...storedEffects, newEffect], campaignName);
        description += ` You have Advantage on your next attack roll against the target. If it hits, add ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'dash_and_damage') {
        await setRuntimeValue(playerStats.name, 'lungingAttackDieValue', dieValue, campaignName);
        description += ` You take the Dash action. Add ${dieValue} to the damage roll of your next melee hit this turn.`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}

export async function handleCombatSuperiorityBonusAction(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeBonusActionManeuver(action, playerStats, campaignName, maneuverName);
}

export async function handleCombatSuperiorityReaction(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeReactionManeuver(action, playerStats, campaignName, maneuverName);
}

export async function handleCombatSuperiorityGrantAttack(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeGrantAttackManeuver(action, playerStats, campaignName, maneuverName);
}

export async function executeGrantAttackManeuver(action, playerStats, campaignName, maneuverName) {
    const allManeuvers = await getManeuversForRules(playerStats.rules);
    const maneuver = allManeuvers.find(m => m.name === maneuverName);

    if (!maneuver) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuverName,
                description: `Maneuver "${maneuverName}" not found.`,
            },
        };
    }

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    if (superiorityDice <= 0 && !(relentless && !relentlessUsed)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
            },
        };
    }

    const superiorityDieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = relentlessRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    const cs = await getCombatContext(campaignName);
    const allies = (cs?.creatures || []).filter(c => c.name !== playerStats.name);
    const options = allies.map(a => ({ label: a.name, value: a.name }));

    if (options.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No allies available to receive the attack.`,
            },
        };
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name}. ${dieDescription} Choose an ally to add this to their next attack.`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    const description = `<b>${maneuver.name}</b><br/>${dieDescription} Choose a willing ally to add ${dieValue} to their next attack's damage roll.`;

    return {
        type: 'modal',
        modalName: 'commanderStrikeChoice',
        payload: {
            playerStats,
            campaignName,
            dieValue,
            maneuverName: maneuver.name,
            options,
            description,
        },
        logEntries: [logEntry],
    };
}

export async function handleCombatSuperioritySweepingAttack(action, playerStats, campaignName, _mapName) {
    const secondaryTargetName = action.automation?.secondaryTargetName;
    if (!secondaryTargetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Sweeping Attack: No secondary target selected.',
            },
        };
    }
    return executeSweepingAttack(action, playerStats, campaignName, secondaryTargetName);
}

export async function executeSweepingAttack(action, playerStats, campaignName, secondaryTargetName) {
    const pendingData = getRuntimeValue(playerStats.name, 'pendingSweepingAttack', campaignName);

    if (!pendingData) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sweeping Attack',
                description: 'Sweeping Attack: No pending data. Use from an attack rider.',
            },
        };
    }

    const { dieValue, damageType, targetName, secondaryTargets } = pendingData;

    const secondaryTarget = secondaryTargets.find(t => t.name === secondaryTargetName);
    if (!secondaryTarget) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sweeping Attack',
                description: `Sweeping Attack: ${secondaryTargetName} is not a valid secondary target.`,
            },
        };
    }

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const newEffect = {
        target: secondaryTargetName,
        source: 'Sweeping Attack',
        option: 'Sweeping Attack',
        effect: 'secondary_damage',
        value: dieValue,
        damageType: damageType,
        duration: 'instant',
        saveType: null,
        saveDc: null,
        saveAbility: null,
    };
    const updatedEffects = [...storedEffects, newEffect];
    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Sweeping Attack',
        description: `Sweeping Attack: ${secondaryTargetName} takes ${dieValue} ${damageType} damage (same type as original attack against ${targetName}).`,
    };

    let actualDamage = dieValue;
    const cs = await getCombatContext(campaignName);
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    if (cs) {
        const result = applyDamageToTarget(cs, secondaryTargetName, dieValue, [damageType], campaignName, characters, false, playerStats.name);
        if (result.finalDamage > 0) {
            actualDamage = result.finalDamage;
            logEntry.description = `Sweeping Attack: ${secondaryTargetName} takes ${actualDamage} ${damageType} damage (same type as original attack against ${targetName}).`;
        }
    }

    await setRuntimeValue(playerStats.name, 'pendingSweepingAttack', null, campaignName);
    await addEntry(campaignName, logEntry).catch(() => {});

    const description = `<b>Sweeping Attack</b><br/>${secondaryTargetName} takes ${actualDamage} ${damageType} damage (same type as the original attack).`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Sweeping Attack',
            description,
        },
        logEntries: [logEntry],
    };
}

export async function handleCombatSuperiorityMovement(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeMovementManeuver(action, playerStats, campaignName, maneuverName);
}

export async function executeMovementManeuver(action, playerStats, campaignName, maneuverName) {
    const allManeuvers = await getManeuversForRules(playerStats.rules);
    const maneuver = allManeuvers.find(m => m.name === maneuverName);

    if (!maneuver) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuverName,
                description: `Maneuver "${maneuverName}" not found.`,
            },
        };
    }

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    if (superiorityDice <= 0 && !(relentless && !relentlessUsed)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
            },
        };
    }

    const superiorityDieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = relentlessRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name}. ${dieDescription} You or the ally gains +${dieValue} AC until the start of your next turn.`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    const description = `<b>${maneuver.name}</b><br/>${dieDescription} You or the ally gains +${dieValue} AC until the start of your next turn.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}

export async function executeReactionManeuver(action, playerStats, campaignName, maneuverName) {
    const allManeuvers = await getManeuversForRules(playerStats.rules);
    const maneuver = allManeuvers.find(m => m.name === maneuverName);

    if (!maneuver) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuverName,
                description: `Maneuver "${maneuverName}" not found.`,
            },
        };
    }

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    if (superiorityDice <= 0 && !(relentless && !relentlessUsed)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
            },
        };
    }

    const superiorityDieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || null;

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = relentlessRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name} as a reaction. ${dieDescription} ${maneuver.description}`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    let description = `<b>${maneuver.name}</b> (Reaction)<br/>${dieDescription}`;

    if (targetName && maneuver.effect !== 'damage_reduction') {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.effect === 'melee_attack_reaction') {
        await setRuntimeValue(playerStats.name, 'pendingRiposteDieValue', dieValue, campaignName);

        const meleeAttacks = (playerStats.attacks || []).filter(a => {
            if (a.weaponType === 'melee' || a.attackType === 'melee') return true;
            if (a.range === 5 || a.range === '5' || a.range === '5 ft' || a.range === '5_ft') return a.type === 'Action' || a.actionType === 'Action';
            if (a.isRanged === false) return true;
            if (Array.isArray(a.properties) && a.properties.some(p => String(p).toLowerCase() === 'melee')) return true;
            return false;
        });
        const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

        if (!attack) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: maneuver.name,
                    description: `${maneuver.name}: No melee attack available.`,
                },
                logEntries: [logEntry],
            };
        }

        return {
            type: 'attack_roll',
            payload: {
                attack,
                targetName,
            },
            logEntries: [logEntry],
        };
    }

    if (maneuver.effect === 'damage_reduction') {
        const strMod = (playerStats.abilities || []).find(a => a.name === 'Strength')?.bonus || 0;
        const dexMod = (playerStats.abilities || []).find(a => a.name === 'Dexterity')?.bonus || 0;
        const mod = Math.max(strMod, dexMod);
        const reduction = dieValue + mod;
        description += ` Damage reduced by ${reduction} (${dieValue} + ${mod} from STR/DEX modifier).`;
        const storedMaxHp = getRuntimeValue(playerStats.name, 'hitPoints', campaignName);
        const storedCurrentHp = getRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
        const maxHp = storedMaxHp != null ? Number(storedMaxHp) : (storedCurrentHp || 10);
        const currentHp = storedCurrentHp != null ? Number(storedCurrentHp) : 10;
        const newHp = Math.min(maxHp, currentHp + reduction);
        if (newHp !== currentHp) {
            await setRuntimeValue(playerStats.name, 'currentHitPoints', newHp, campaignName);
        }
        description += ` HP restored: ${currentHp} → ${newHp}.`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}

export async function handleCombatSuperioritySkillCheck(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeSkillCheckManeuver(action, playerStats, campaignName, maneuverName);
}

export async function executeSkillCheckManeuver(action, playerStats, campaignName, maneuverName) {
    const allManeuvers = await getManeuversForRules(playerStats.rules);
    const maneuver = allManeuvers.find(m => m.name === maneuverName);

    if (!maneuver) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuverName,
                description: `Maneuver "${maneuverName}" not found.`,
            },
        };
    }

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    if (superiorityDice <= 0 && !(relentless && !relentlessUsed)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
            },
        };
    }

    const superiorityDieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = relentlessRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    await setRuntimeValue(playerStats.name, 'pendingSkillCheckBonus', dieValue, campaignName);

    const skills = maneuver.skills || [];
    let skillList = '';
    if (maneuver.initiativeBonus) {
        skillList = 'Initiative or Stealth';
    } else if (skills.length > 0) {
        skillList = skills.join(' / ');
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name}. ${dieDescription} Added ${dieValue} to the next ${skillList || 'skill'} check.`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    let description = `<b>${maneuver.name}</b><br/>${dieDescription}`;

    if (maneuver.initiativeBonus) {
        description += ` Add ${dieValue} to your next Initiative roll or Dexterity (Stealth) check.`;
    } else {
        const ability = maneuver.ability || 'the ability';
        description += ` Add ${dieValue} to your next ${ability} (${skillList || 'skill check'}).`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}

export async function handleCombatSuperiorityCommandingPresenceReaction(action, playerStats, campaignName, _mapName) {
    const maneuverName = action.automation?.maneuverName;
    if (!maneuverName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver specified.',
            },
        };
    }
    return executeCommandingPresenceReaction(action, playerStats, campaignName, maneuverName);
}

export async function executeCommandingPresenceReaction(action, playerStats, campaignName, maneuverName) {
    const allManeuvers = await getManeuversForRules(playerStats.rules);
    const maneuver = allManeuvers.find(m => m.name === maneuverName);

    if (!maneuver) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuverName,
                description: `Maneuver "${maneuverName}" not found.`,
            },
        };
    }

    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    if (superiorityDice <= 0 && !(relentless && !relentlessUsed)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
            },
        };
    }

    const superiorityDieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = relentlessRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name} as a reaction. ${dieDescription}`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    const auto = action.automation || {};
    const targetName = auto.targetName;
    const reactionEffect = auto.reactionEffect || 'disadvantage_next_attack';
    const reactionDuration = auto.reactionDuration || 'until_end_of_next_turn';

    let description = `<b>${maneuver.name}</b> (Reaction)<br/>${dieDescription}`;

    if (targetName) {
        description += ` Target: ${targetName}.`;
    }

    if (reactionEffect === 'disadvantage_next_attack') {
        const durationInTurns = reactionDuration === 'until_end_of_next_turn' ? 2 : 1;
        description += ` ${targetName || 'The target'} has Disadvantage on their next attack roll.`;
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const hasDisadvantage = conditions.some(c => String(c).toLowerCase() === 'disadvantage');
        if (!hasDisadvantage && targetName) {
            await setRuntimeValue(targetName, 'activeConditions', [...conditions, 'disadvantage'], campaignName);
        }
        if (targetName) {
            const cs = await getCombatContext(campaignName);
            applyConditionToTarget(targetName, 'disadvantage', campaignName, cs);
            await addExpiration(playerStats.name, targetName, [
                { type: 'condition', condition: 'disadvantage' },
            ], campaignName, durationInTurns);
        }
    } else if (reactionEffect === 'attack_roll_disadvantage') {
        description += ` ${targetName || 'The target'} has Disadvantage on their next attack roll.`;
        if (targetName) {
            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const hasDisadvantage = conditions.some(c => String(c).toLowerCase() === 'disadvantage');
            if (!hasDisadvantage) {
                await setRuntimeValue(targetName, 'activeConditions', [...conditions, 'disadvantage'], campaignName);
            }
            const cs = await getCombatContext(campaignName);
            applyConditionToTarget(targetName, 'disadvantage', campaignName, cs);
            await addExpiration(playerStats.name, targetName, [
                { type: 'condition', condition: 'disadvantage' },
            ], campaignName, 2);
        }
    } else if (reactionEffect === 'save_disadvantage') {
        description += ` ${targetName || 'The target'} has Disadvantage on their next saving throw.`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}

export async function executeManeuver(action, playerStats, campaignName, maneuverName) {
    const auto = action.automation;
    const allManeuvers = await loadManeuvers(playerStats.rules || '2024');
    const maneuver = allManeuvers.find(m => m.name === maneuverName);

    if (!maneuver) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Maneuver "${maneuverName}" not found.`,
                automation: auto,
            },
        };
    }

    const usesKey = 'superiorityDice';
    const defaultMax = auto.uses_max || 4;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? defaultMax);

    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    if (currentUses <= 0 && !(relentless && !relentlessUsed)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    const superiorityDieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || null;

    if (targetName && maneuver.sizeLimit) {
        const sizeCheck = await validateSizeLimit(maneuver, targetName, campaignName, playerStats);
        if (!sizeCheck.valid) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: maneuver.name,
                    description: sizeCheck.description,
                    automation: auto,
                },
            };
        }
    }

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = relentlessRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', currentUses - 1, campaignName);
    }

    let description = `${maneuver.name}: ${dieDescription}`;

    if (targetName && maneuver.effect !== 'ac_bonus_disengage' && maneuver.effect !== 'ac_bonus_and_swap' && maneuver.effect !== 'damage_reduction' && maneuver.effect !== 'dash_and_damage') {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.damageBonus) {
        description += ` Added ${dieValue} to the damage roll.`;
    }

    if (maneuver.saveType && targetName) {
        const saveDc = buildSaveDc(auto, playerStats);
        const { promise } = createSaveListener(campaignName, {
            targetName,
            saveType: maneuver.saveType,
            saveDc,
        });

        const saveResult = await promise;
        const success = saveResult.success;

        description += ` Target made ${maneuver.saveType} save DC ${saveDc}: ${success ? 'Success' : 'Failure'}.`;

        if (!success) {
            if (maneuver.effect === 'frightened') {
                description += ` ${targetName} is Frightened until the end of your next turn.`;
                const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
                const conditions = Array.isArray(storedConditions) ? storedConditions : [];
                const hasFrightened = conditions.some(c => String(c).toLowerCase() === 'frightened');
                if (!hasFrightened) {
                    await setRuntimeValue(targetName, 'activeConditions', [...conditions, 'frightened'], campaignName);
                }
                const cs = await getCombatContext(campaignName);
                applyConditionToTarget(targetName, 'frightened', campaignName, cs);
                await addExpiration(playerStats.name, targetName, [
                    { type: 'condition', condition: 'frightened' },
                ], campaignName, 2);
            } else if (maneuver.effect === 'disarm') {
                description += ` ${targetName} dropped the object it was holding.`;
            } else if (maneuver.effect === 'push') {
                const pushDistance = maneuver.value || 15;
                description += ` ${targetName} was pushed ${pushDistance} feet away.`;
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const newEffect = {
                    target: targetName,
                    source: maneuver.name,
                    option: maneuver.name,
                    effect: 'push',
                    value: pushDistance,
                    duration: 'instant',
                    saveType: maneuver.saveType,
                    saveDc,
                    saveAbility: maneuver.saveAbility,
                };
                const updatedEffects = [...storedEffects, newEffect];
                setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
            } else if (maneuver.effect === 'goad') {
                description += ` ${targetName} has Disadvantage on attacks against targets other than you.`;
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const newEffect = {
                    target: targetName,
                    source: playerStats.name,
                    effect: 'goad',
                    duration: 'until_end_of_user_next_turn',
                };
                const updatedEffects = [...storedEffects, newEffect];
                setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
            } else if (maneuver.effect === 'prone') {
                description += ` ${targetName} fell Prone.`;
                const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
                const conditions = Array.isArray(storedConditions) ? storedConditions : [];
                const hasProne = conditions.some(c => String(c).toLowerCase() === 'prone');
                if (!hasProne) {
                    await setRuntimeValue(targetName, 'activeConditions', [...conditions, 'prone'], campaignName);
                }
                const cs = await getCombatContext(campaignName);
                applyConditionToTarget(targetName, 'prone', campaignName, cs);
            } else if (maneuver.conditionInflicted) {
                description += ` ${targetName} gained the ${maneuver.conditionInflicted} condition.`;
            } else {
                description += ` The effect was applied to ${targetName}.`;
            }
        }
    } else if (maneuver.saveType) {
        const saveDc = buildSaveDc(auto, playerStats);
        description += ` Target must make a ${maneuver.saveType} save DC ${saveDc}`;
        if (maneuver.conditionInflicted) {
            description += ` or gain ${maneuver.conditionInflicted} condition`;
        } else if (maneuver.effect === 'disarm') {
            description += ` or drop one object it's holding`;
        } else if (maneuver.effect === 'push') {
            description += ` or be pushed ${maneuver.value || 15} feet away`;
        } else if (maneuver.effect === 'goad') {
            description += ` or have Disadvantage on attacks against targets other than you`;
        } else {
            description += ` or suffer the effect`;
        }
        description += '.';
    }

    if (maneuver.effect === 'next_attack_advantage' || maneuver.effect === 'distracting_strike_advantage') {
        description += ` The next attack against ${targetName || 'the target'} by an ally has Advantage.`;
        if (targetName) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const newEffect = {
                target: targetName,
                source: playerStats.name,
                effect: 'distracting_strike_advantage',
                value: null,
                duration: 'until_end_of_turn',
            };
            await setRuntimeValue(campaignName, 'targetEffects', [...storedEffects, newEffect], campaignName);
        }
    }

    if (maneuver.effect === 'ally_movement') {
        description += ` An ally can use its Reaction to move up to half its Speed without provoking Opportunity Attacks.`;
    }

    if (maneuver.actionType === 'grant_attack') {
        description += ` Choose a willing ally to add ${dieValue} to their next attack's damage roll.`;
        const cs = await getCombatContext(campaignName);
        const allies = (cs?.creatures || []).filter(c => c.name !== playerStats.name);
        const options = allies.map(a => ({ label: a.name, value: a.name }));

        if (options.length === 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: maneuver.name,
                    description: `${maneuver.name}: No allies available to receive the attack.`,
                    automation: auto,
                },
            };
        }

        const logEntry = {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: maneuver.name,
            description,
        };
        return {
            type: 'modal',
            modalName: 'commanderStrikeChoice',
            payload: {
                playerStats,
                campaignName,
                dieValue,
                maneuverName: maneuver.name,
                options,
                description,
            },
            logEntries: [logEntry],
        };
    }

    if (maneuver.effect === 'ac_bonus_and_swap') {
        description += ` You or an ally gains +${dieValue} AC until the start of your next turn.`;
        const cs = await getCombatContext(campaignName);
        const allies = cs?.creatures?.filter(c =>
            c.name !== playerStats.name
        ) || [];
        const options = [
            { label: `Myself (${playerStats.name})`, value: playerStats.name },
            ...allies.map(a => ({ label: a.name, value: a.name })),
        ];
        const logEntry = {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: maneuver.name,
            description,
        };
        return {
            type: 'modal',
            modalName: 'baitAndSwitchChoice',
            payload: {
                playerStats,
                campaignName,
                dieValue,
                maneuverName: maneuver.name,
                options,
                description,
            },
            logEntries: [logEntry],
        };
    }

    if (maneuver.effect === 'ac_bonus_disengage') {
        description += ` You take the Disengage action and gain +${dieValue} AC until the start of your next turn.`;
        await setRuntimeValue(playerStats.name, 'baitAndSwitchActive', true, campaignName);
        await setRuntimeValue(playerStats.name, 'baitAndSwitchBonus', dieValue, campaignName);
        await setRuntimeValue(playerStats.name, 'baitAndSwitchSource', maneuver.name, campaignName);
        await addExpiration(playerStats.name, playerStats.name, [
            { type: 'bait_and_switch_clear' }
        ], campaignName, undefined, playerStats.name);
    }

    if (maneuver.effect === 'advantage_and_damage') {
        await setRuntimeValue(playerStats.name, 'feintingAttackDieValue', dieValue, campaignName);
        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const currentRound = getCurrentCombatRound();
        const newEffect = {
            target: playerStats.name,
            source: maneuver.name,
            effect: 'next_attack_advantage',
            vexTarget: targetName || null,
            value: null,
            duration: 'until_end_of_turn',
            appliedRound: currentRound,
        };
        await setRuntimeValue(campaignName, 'targetEffects', [...storedEffects, newEffect], campaignName);
        description += ` You have Advantage on your next attack roll against the target. If it hits, add ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'dash_and_damage') {
        await setRuntimeValue(playerStats.name, 'lungingAttackDieValue', dieValue, campaignName);
        description += ` You take the Dash action. Add ${dieValue} to the damage roll of your next melee hit this turn.`;
    }

    if (maneuver.effect === 'temp_hp') {
        const fighterLevel = playerStats.level || 1;
        const extraHpRaw = maneuver.extraHpExpression
            ? evaluateAutoExpression(maneuver.extraHpExpression, playerStats)
            : Math.floor(fighterLevel / 2);
        const extraHp = typeof extraHpRaw === 'number' ? Math.floor(extraHpRaw) : Math.floor(fighterLevel / 2);
        const totalHp = dieValue + extraHp;
        const cs = await getCombatContext(campaignName);
        const allies = cs?.creatures?.filter(c => c.name !== playerStats.name) || [];
        if (allies.length === 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: maneuver.name,
                    description: `${maneuver.name}: No allies available to receive Rally.`,
                },
            };
        }
        const allyOptions = allies.map(a => ({ label: a.name, value: a.name }));
        const logEntry = {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: maneuver.name,
            description: `${maneuver.name}: Choose an ally to gain temporary hit points.`,
        };
        return {
            type: 'modal',
            modalName: 'rallyChoice',
            payload: {
                playerStats,
                campaignName,
                dieValue,
                maneuverName: maneuver.name,
                allyOptions,
                totalHp,
                extraHp,
                description,
            },
            logEntries: [logEntry],
        };
    }

    if (maneuver.effect === 'damage_reduction') {
        const strMod = (playerStats.abilities || []).find(a => a.name === 'Strength')?.bonus || 0;
        const dexMod = (playerStats.abilities || []).find(a => a.name === 'Dexterity')?.bonus || 0;
        const mod = Math.max(strMod, dexMod);
        const reduction = dieValue + mod;
        description += ` Damage reduced by ${reduction} (${dieValue} + ${mod} from STR/DEX modifier).`;
        const storedMaxHp = getRuntimeValue(playerStats.name, 'hitPoints', campaignName);
        const storedCurrentHp = getRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
        const maxHp = storedMaxHp != null ? Number(storedMaxHp) : (storedCurrentHp || 10);
        const currentHp = storedCurrentHp != null ? Number(storedCurrentHp) : 10;
        const newHp = Math.min(maxHp, currentHp + reduction);
        if (newHp !== currentHp) {
            await setRuntimeValue(playerStats.name, 'currentHitPoints', newHp, campaignName);
        }
        description += ` HP restored: ${currentHp} → ${newHp}.`;
    }

    if (maneuver.effect === 'melee_attack_reaction') {
        await setRuntimeValue(playerStats.name, 'pendingRiposteDieValue', dieValue, campaignName);

        const cs = await loadCombatSummary(campaignName);
        const lastAttack = cs?.lastAttack;
        const riposteTarget = lastAttack?.attackerName || targetName;

        if (riposteTarget && riposteTarget !== targetName && maneuver.effect !== 'ac_bonus_disengage' && maneuver.effect !== 'ac_bonus_and_swap' && maneuver.effect !== 'damage_reduction') {
            description = description.replace(`Target: ${targetName}.`, `Target: ${riposteTarget}.`);
        }

        const meleeAttacks = (playerStats.attacks || []).filter(a => {
            if (a.weaponType === 'melee' || a.attackType === 'melee') return true;
            if (a.range === 5 || a.range === '5' || a.range === '5 ft' || a.range === '5_ft') return a.type === 'Action' || a.actionType === 'Action';
            if (a.isRanged === false) return true;
            if (Array.isArray(a.properties) && a.properties.some(p => String(p).toLowerCase() === 'melee')) return true;
            return false;
        });
        const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

        if (!attack) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: maneuver.name,
                    description: `${maneuver.name}: No melee attack available.`,
                    automation: auto,
                },
            };
        }

        const logEntry = {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: maneuver.name,
            description,
        };
        const popupPayload = {
            type: 'automation_info',
            name: maneuver.name,
            description,
            automation: auto,
        };
        return {
            type: 'attack_roll',
            payload: {
                attack,
                targetName: riposteTarget,
            },
            context: {
                superiorityDieValue: dieValue,
                superiorityDieSize: superiorityDieSize,
                baseDamageFormula: attack.damage,
                baseDamageType: attack.damageType,
            },
            logEntries: [logEntry],
            popup: popupPayload,
        };
    }

    if (maneuver.effect === 'secondary_damage') {
        description += ` A second creature within 5 feet of the target takes ${dieValue} damage (same type as the original attack).`;
    }

    if (maneuver.effect === 'attack_roll_bonus') {
        description += ` Add ${dieValue} to the attack roll.`;
    }

    if (maneuver.actionType === 'skill_check') {
        description += ` Add ${dieValue} to the ability check.`;
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description,
    };

    return {
        type: 'popup',
        effect: maneuver.effect,
        dieValue,
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
            automation: auto,
        },
        logEntries: [logEntry],
    };
}

export async function executeBaitAndSwitchChoice(action, playerStats, campaignName, chosenName) {
    if (!chosenName || !playerStats || !campaignName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Bait and Switch',
                description: 'No target selected for Bait and Switch AC bonus.',
            },
        };
    }

    const dieValue = action.dieValue;
    const maneuverName = action.maneuverName || 'Bait and Switch';

    await setRuntimeValue(chosenName, 'baitAndSwitchActive', true, campaignName);
    await setRuntimeValue(chosenName, 'baitAndSwitchBonus', dieValue, campaignName);
    await setRuntimeValue(chosenName, 'baitAndSwitchSource', maneuverName, campaignName);
    await addExpiration(playerStats.name, chosenName, [
        { type: 'bait_and_switch_clear' }
    ], campaignName, undefined, playerStats.name);

    const description = `${maneuverName}: ${chosenName} gains +${dieValue} AC until the start of ${playerStats.name}'s next turn.`;

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuverName,
        description,
    };

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuverName,
            description,
        },
        logEntries: [logEntry],
    };
}

export async function executeCommanderStrikeChoice(action, playerStats, campaignName, chosenName) {
    if (!chosenName || !playerStats || !campaignName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: "Commander's Strike",
                description: 'No target selected for Commander\'s Strike damage bonus.',
            },
        };
    }

    const dieValue = action.dieValue;
    const maneuverName = action.maneuverName || "Commander's Strike";

    await setRuntimeValue(chosenName, 'commanderStrikeActive', true, campaignName);
    await setRuntimeValue(chosenName, 'commanderStrikeBonus', dieValue, campaignName);
    await setRuntimeValue(chosenName, 'commanderStrikeSource', maneuverName, campaignName);

    const description = `${maneuverName}: ${chosenName} will add ${dieValue} to their next attack's damage roll.`;

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuverName,
        description,
    };

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuverName,
            description,
        },
        logEntries: [logEntry],
    };
}

export async function executeRallyChoice(action, playerStats, campaignName, chosenName, totalHp, extraHp, description) {
    if (!chosenName || !playerStats || !campaignName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Rally',
                description: 'No target selected for Rally.',
            },
        };
    }

    const dieValue = action.dieValue;
    const maneuverName = action.maneuverName || 'Rally';

    setRuntimeValue(chosenName, 'tempHp', totalHp, campaignName);

    await addExpiration(playerStats.name, chosenName, [
        { type: 'rally_clear' }
    ], campaignName, undefined, playerStats.name);

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuverName,
        description: `${maneuverName}: ${chosenName} gains ${totalHp} temporary hit points.`,
        d10Roll: dieValue,
    };

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuverName,
            description,
        },
        logEntries: [logEntry],
    };
}
