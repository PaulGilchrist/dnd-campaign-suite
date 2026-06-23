import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { loadManeuvers } from '../../../ui/dataLoader.js';
import { addEntry } from '../../../ui/logService.js';

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

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

function getSuperiorityDice(playerStats, campaignName) {
    const usesKey = 'superiorityDice';
    const defaultMax = 4;
    return Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? defaultMax);
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
        if (m.trigger === 'weapon_attack_hit') {
            return isWeaponAttack;
        }
        if (m.trigger === 'melee_weapon_attack_hit') {
            return isMeleeAttack;
        }
        return true;
    });
}

function getManeuversByType(playerStats, campaignName, knownNames, actionType, attackInfo) {
    return allManeuversCache.get(`${playerStats.rules || '2024'}_${knownNames.sort().join(',')}`)
        ?.filter(m => {
            if (actionType && m.actionType !== actionType) return false;
            if (attackInfo && m.trigger && m.trigger !== 'any') {
                const isWeaponAttack = attackInfo.weaponType === 'melee' || attackInfo.weaponType === 'ranged' || attackInfo.isUnarmedStrike;
                const isMeleeAttack = attackInfo.weaponType === 'melee' || attackInfo.isUnarmedStrike;
                if (m.trigger === 'weapon_attack_hit' && !isWeaponAttack) return false;
                if (m.trigger === 'melee_weapon_attack_hit' && !isMeleeAttack) return false;
            }
            return true;
        }) || [];
}

const allManeuversCache = new Map();

async function getManeuversForRules(rules) {
    const key = rules || '2024';
    if (!allManeuversCache.has(key)) {
        const maneuvers = await loadManeuvers(key);
        allManeuversCache.set(key, maneuvers);
    }
    return allManeuversCache.get(key);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
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
        };
    }

    const maxOptions = auto.maxOptions || 3;

    const unknownManeuvers = allManeuvers.filter(m => !knownManeuvers.includes(m.name));
    const known = allManeuvers.filter(m => knownManeuvers.includes(m.name));

    const needsSelection = known.length < maxOptions && unknownManeuvers.length > 0;

    const modalPayload = {
        action,
        playerStats,
        campaignName,
        allManeuvers,
        knownManeuvers: known.map(m => m.name),
        maxOptions,
        selectionMode: needsSelection,
        saveDc: auto.saveDc,
        saveType: auto.saveType || 'WIS',
        dieExpression: auto.dieExpression || 'superiority_die',
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

        await setRuntimeValue(playerStats.name, SELECTION_KEY, validNames, campaignName, true);

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

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression('1d8');
        dieValue = relentlessRoll?.total || 8;
        dieDescription = `Rolled 1d8 for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const superiorityDieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled ${superiorityDieSize} for ${dieValue}.`;
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

    if (superiorityDice <= 0 && !relentless) {
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

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name}. Superiority die rolled ${dieValue}. ${targetName ? `Target: ${targetName}. ` : ''}${maneuver.description}`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    let description = `<b>${maneuver.name}</b><br/>${dieDescription}`;

    if (targetName) {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.damageBonus) {
        description += ` Added ${dieValue} to the damage roll.`;
    }

    if (maneuver.saveType) {
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

    if (maneuver.effect === 'next_attack_advantage') {
        description += ` The next attack against ${targetName || 'the target'} by an ally has Advantage.`;
    }

    if (maneuver.effect === 'ally_movement') {
        description += ` An ally can use its Reaction to move up to half its Speed without provoking Opportunity Attacks.`;
    }

    if (maneuver.actionType === 'grant_attack') {
        description += ` An ally can use its Reaction to make an attack, adding ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'secondary_damage') {
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

    if (superiorityDice <= 0 && !relentless) {
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
        const relentlessRoll = rollExpression('1d8');
        dieValue = relentlessRoll?.total || 8;
        dieDescription = `Rolled 1d8 for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled ${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name} as a bonus action. Superiority die rolled ${dieValue}. ${maneuver.description}`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    let description = `<b>${maneuver.name}</b> (Bonus Action)<br/>${dieDescription}`;

    if (targetName) {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.saveType) {
        description += ` Target must make a ${maneuver.saveType} save or suffer the effect.`;
    }

    if (maneuver.effect === 'temp_hp') {
        const fighterLevel = playerStats.level || 1;
        const extraHp = Math.floor(fighterLevel / 2);
        const totalHp = dieValue + extraHp;
        description += ` An ally gains ${totalHp} Temporary Hit Points (${dieValue} from die + ${extraHp} from half Fighter level).`;
    }

    if (maneuver.effect === 'ac_bonus_disengage') {
        description += ` You take the Disengage action and gain +${dieValue} AC until the start of your next turn.`;
    }

    if (maneuver.effect === 'advantage_and_damage') {
        description += ` You have Advantage on your next attack roll against the target. If it hits, add ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'dash_and_damage') {
        description += ` You take the Dash action. If you move 5+ feet in a straight line before a melee hit this turn, add ${dieValue} to the damage roll.`;
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

    if (superiorityDice <= 0 && !relentless) {
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
        const relentlessRoll = rollExpression('1d8');
        dieValue = relentlessRoll?.total || 8;
        dieDescription = `Rolled 1d8 for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled ${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name}. Superiority die rolled ${dieValue}. An ally can use their Reaction to make an attack, adding ${dieValue} to the damage roll.`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    const description = `<b>${maneuver.name}</b><br/>${dieDescription} An ally can use their Reaction to make an attack, adding ${dieValue} to the damage roll.`;

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

    if (superiorityDice <= 0 && !relentless) {
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
        const relentlessRoll = rollExpression('1d8');
        dieValue = relentlessRoll?.total || 8;
        dieDescription = `Rolled 1d8 for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled ${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name}. Superiority die rolled ${dieValue}. You or the ally gains +${dieValue} AC until the start of your next turn.`,
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

    if (superiorityDice <= 0 && !relentless) {
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
        const relentlessRoll = rollExpression('1d8');
        dieValue = relentlessRoll?.total || 8;
        dieDescription = `Rolled 1d8 for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled ${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name} as a reaction. Superiority die rolled ${dieValue}. ${maneuver.description}`,
    };
    await addEntry(campaignName, logEntry).catch(() => {});

    let description = `<b>${maneuver.name}</b> (Reaction)<br/>${dieDescription}`;

    if (targetName) {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.effect === 'damage_reduction') {
        const strMod = (playerStats.abilities || []).find(a => a.name === 'Strength')?.bonus || 0;
        const dexMod = (playerStats.abilities || []).find(a => a.name === 'Dexterity')?.bonus || 0;
        const mod = Math.max(strMod, dexMod);
        const reduction = dieValue + mod;
        description += ` Damage reduced by ${reduction} (${dieValue} + ${mod} from STR/DEX modifier).`;
    }

    if (maneuver.effect === 'melee_attack_reaction') {
        description += ` Make a melee attack against the target. On a hit, add ${dieValue} to the damage roll.`;
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

    if (superiorityDice <= 0 && !relentless) {
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
        const relentlessRoll = rollExpression('1d8');
        dieValue = relentlessRoll?.total || 8;
        dieDescription = `Rolled 1d8 for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled ${superiorityDieSize} for ${dieValue}.`;
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
        description: `Used ${maneuver.name}. Superiority die rolled ${dieValue}. Added ${dieValue} to the next ${skillList || 'skill'} check.`,
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

async function executeManeuver(action, playerStats, campaignName, maneuverName) {
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

    if (currentUses <= 0 && !relentless) {
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

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression('1d8');
        dieValue = relentlessRoll?.total || 8;
        dieDescription = `Rolled 1d8 for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled ${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', currentUses - 1, campaignName);
    }

    let description = `${maneuver.name}: ${dieDescription}`;

    if (targetName) {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.damageBonus) {
        description += ` Added ${dieValue} to the damage roll.`;
    }

    if (maneuver.saveType) {
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

    if (maneuver.effect === 'next_attack_advantage') {
        description += ` The next attack against ${targetName || 'the target'} by an ally has Advantage.`;
    }

    if (maneuver.effect === 'ally_movement') {
        description += ` An ally can use its Reaction to move up to half its Speed without provoking Opportunity Attacks.`;
    }

    if (maneuver.actionType === 'grant_attack') {
        description += ` An ally can use its Reaction to make an attack, adding ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'ac_bonus_and_swap') {
        description += ` You or the ally gains +${dieValue} AC until the start of your next turn.`;
    }

    if (maneuver.effect === 'ac_bonus_disengage') {
        description += ` You take the Disengage action and gain +${dieValue} AC until the start of your next turn.`;
    }

    if (maneuver.effect === 'advantage_and_damage') {
        description += ` You have Advantage on your next attack roll against the target. If it hits, add ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'dash_and_damage') {
        description += ` You take the Dash action. If you move 5+ feet in a straight line before a melee hit this turn, add ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'temp_hp') {
        const fighterLevel = playerStats.level || 1;
        const extraHp = Math.floor(fighterLevel / 2);
        const totalHp = dieValue + extraHp;
        description += ` An ally gains ${totalHp} Temporary Hit Points (${dieValue} from die + ${extraHp} from half Fighter level).`;
    }

    if (maneuver.effect === 'damage_reduction') {
        const strMod = (playerStats.abilities || []).find(a => a.name === 'Strength')?.bonus || 0;
        const dexMod = (playerStats.abilities || []).find(a => a.name === 'Dexterity')?.bonus || 0;
        const mod = Math.max(strMod, dexMod);
        const reduction = dieValue + mod;
        description += ` Damage reduced by ${reduction} (${dieValue} + ${mod} from STR/DEX modifier).`;
    }

    if (maneuver.effect === 'melee_attack_reaction') {
        description += ` Make a melee attack against the target. On a hit, add ${dieValue} to the damage roll.`;
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

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
            automation: auto,
        },
    };
}
