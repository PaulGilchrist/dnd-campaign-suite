import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { setTempHp } from './tempHpService.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { resolveFeatChosenAbility } from '../../../shared/abilityLookup.js';

function getBardicDieSize(playerStats) {
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    return classLevel?.bardic_die || 6;
}

function getAbilityModifier(playerStats, abilityName) {
    const abil = playerStats.abilities?.find(a => a.name === abilityName);
    if (!abil) return 0;
    const score = abil.score ?? abil.totalScore;
    if (score == null) return 0;
    return Math.floor((score - 10) / 2);
}

function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (auto.craftCount && auto.tempHpExpression) {
        return handleBolsteringTreats(action, playerStats, campaignName, _mapName);
    }

    if (auto.bonusMovement && auto.tempHpExpression && auto.tempHpExpression.includes('bardic_inspiration_die')) {
        return handleMantleOfInspiration(action, playerStats, campaignName, _mapName);
    }

    if (auto.multiTargetAlly) {
        return handleMultiTargetAllyTempHp(action, playerStats, campaignName);
    }

    if (auto.ongoingHealingExpression && auto.healingStartOfTurn) {
        return handleVitalityOfTheTree(action, playerStats, campaignName, _mapName);
    }

    const tempHpExpression = auto.tempHpExpression || '';
    if (!tempHpExpression) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: No temp HP expression defined.`,
                automation: auto,
            },
        };
    }

    const amount = evaluateAutoExpression(tempHpExpression, playerStats);
    if (typeof amount !== 'number' || amount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: Could not calculate temp HP (${tempHpExpression}).`,
                automation: auto,
            },
        };
    }

    setTempHp(playerName, amount, campaignName);

    let description = `Gained ${amount} temporary hit points from ${action.name}.`;
    if (auto.ongoingHealingExpression) {
        description += ` At the start of each turn while raging, can grant temp HP to a creature within ${auto.healingRange || '10 ft'}.`;
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

function resolveInspiringLeaderTempHp(action, playerStats) {
    const featName = action.name || 'Inspiring Leader';
    const chosenAbility = resolveFeatChosenAbility(featName, playerStats.featAbilityChoices);

    const level = playerStats.level || 1;
    if (chosenAbility) {
        const modifier = getAbilityModifier(playerStats, chosenAbility);
        return level + modifier;
    }

    const tempHpExpression = action.automation?.tempHpExpression || '';
    const amount = evaluateAutoExpression(tempHpExpression, playerStats);
    if (typeof amount === 'number' && amount > 0) return amount;

    const chaMod = getAbilityModifier(playerStats, 'Charisma');
    const wisMod = getAbilityModifier(playerStats, 'Wisdom');
    return level + Math.max(chaMod, wisMod);
}

async function handleMultiTargetAllyTempHp(action, playerStats, campaignName) {
    const auto = action.automation;

    const amount = resolveInspiringLeaderTempHp(action, playerStats);
    if (typeof amount !== 'number' || amount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: Could not calculate temp HP.`,
                automation: auto,
            },
        };
    }

    const maxTargets = auto.targets || 6;
    const combatSummary = await getCombatContext(campaignName);
    const creatureTargets = combatSummary?.creatures
        ? combatSummary.creatures.map(c => ({ name: c.name }))
        : [];

    return {
        type: 'modal',
        modalName: 'bolsteringPerformanceTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            tempHp: amount,
            maxTargets,
        },
    };
}

export async function confirmBolsteringPerformance(action, playerStats, campaignName, selectedTargets, tempHp) {
    const auto = action.automation;
    const finalTargets = (selectedTargets || []).slice(0, auto?.targets || 6);

    for (const targetName of finalTargets) {
        setTempHp(targetName, tempHp, campaignName);
    }

    const targetList = finalTargets.length > 0 ? finalTargets.join(', ') : 'no targets selected';
    const description = `${action.name}: Granted ${tempHp} temporary hit points to ${finalTargets.length} creature${finalTargets.length !== 1 ? 's' : ''} (${targetList}).`;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} used ${action.name}, granting ${tempHp} temporary hit points to ${targetList}.`,
    }).catch((e) => { console.error("[tempHpBuffHandler:log-error]", e); });

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

export async function handleMantleOfInspiration(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const bardicDieSize = getBardicDieSize(playerStats);
    const usesMax = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_inspiration_uses
        || getAbilityModifier(playerStats, 'Charisma');

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, 'bardicInspirationUses') ?? usesMax);
        // usesMax and currentUses available via handleMantleOfInspiration params
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
        await setRuntimeValue(playerName, 'bardicInspirationUses', currentUses - 1, campaignName);
        // decremented to currentUses - 1
    }

    const dieRoll = rollDie(bardicDieSize);
    const tempHp = 2 * dieRoll;

    const chaMod = getAbilityModifier(playerStats, 'Charisma');
    const maxTargets = Math.max(1, chaMod);

    const combatSummary = await getCombatContext(campaignName);
    const creatureTargets = combatSummary?.creatures
        ? combatSummary.creatures
            .map(c => ({ name: c.name }))
        : [];

    return {
        type: 'modal',
        modalName: 'mantleOfInspirationTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            tempHp,
            dieRoll,
            bardicDieSize,
            maxTargets,
        },
    };
}

export async function confirmMantleOfInspiration(action, playerStats, campaignName, selectedTargets, dieRoll, bardicDieSize, tempHp) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const finalTargets = (selectedTargets || []).slice(0, Math.max(1, getAbilityModifier(playerStats, 'Charisma')));

    for (const targetName of finalTargets) {
        setTempHp(targetName, tempHp, campaignName);
        setRuntimeValue(targetName, 'inspiringMovementNoOA', true, campaignName);
        addExpiration(playerName, targetName, [
            { type: 'inspiring_movement_no_oa' }
        ], campaignName, undefined, playerName);
    }

    const targetList = finalTargets.length > 0 ? finalTargets.join(', ') : 'no targets selected';
    const targetDetail = finalTargets.length > 0 ? ` Each target can use their Reaction to move up to their Speed without provoking Opportunity Attacks.` : '';
    const description = `${action.name}: Rolled ${dieRoll} (1d${bardicDieSize}), granting ${tempHp} temporary hit points to ${targetList}.${targetDetail}`;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} (rolled ${dieRoll} on 1d${bardicDieSize} = ${tempHp} temp HP). Targets: ${targetList}.${targetDetail}`,
    }).catch((e) => { console.error("[tempHpBuffHandler:log-error]", e); });

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

export function grantTempHpOnRage(action, playerStats, campaignName) {
    const auto = action.automation;
    if (!auto.triggerOnRage) return false;

    const tempHpExpression = auto.tempHpExpression || '';
    if (!tempHpExpression) return false;

    const amount = evaluateAutoExpression(tempHpExpression, playerStats);
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return false;

    setTempHp(playerStats.name, amount, campaignName);

    return true;
}

function rollDiceExpression(expr, playerStats) {
    if (!expr) return null;
    const resolved = evaluateAutoExpression(expr, playerStats);
    if (typeof resolved === 'number') return resolved;
    if (typeof resolved !== 'string') return null;
    const match = resolved.match(/^(\d+)d(\d+)$/);
    if (!match) return null;
    const [, count, sides] = match;
    let total = 0;
    for (let i = 0; i < parseInt(count, 10); i++) {
        total += rollDie(parseInt(sides, 10));
    }
    return total;
}

export async function handleVitalityOfTheTree(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const currentRound = getCurrentCombatRound(campaignName);
    const rageActivationRound = getRuntimeValue(playerName, 'vitalityOfTheTreeRageRound');

    const roundsElapsed = currentRound - (rageActivationRound ?? currentRound);
    const maxTargets = Math.max(1, roundsElapsed);

    const tempHpAmount = rollDiceExpression(auto.ongoingHealingExpression, playerStats);
    if (typeof tempHpAmount !== 'number' || tempHpAmount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: Could not calculate temp HP (${auto.ongoingHealingExpression}).`,
                automation: auto,
            },
        };
    }

    const combatSummary = await getCombatContext(campaignName);
    const creatureTargets = combatSummary?.creatures
        ? combatSummary.creatures.map(c => ({ name: c.name }))
        : [];

    if (roundsElapsed <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: No creatures can be selected yet — this is the same round your Rage activated.`,
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'vitalityOfTheTreeTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            tempHp: tempHpAmount,
            maxTargets,
        },
    };
}

export async function confirmVitalityOfTheTree(action, playerStats, campaignName, selectedTargets, tempHp, maxTargets) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const finalTargets = (selectedTargets || []).slice(0, maxTargets || 999);

    for (const targetName of finalTargets) {
        setTempHp(targetName, tempHp, campaignName);
    }

    const targetList = finalTargets.length > 0 ? finalTargets.join(', ') : 'no targets selected';
    const description = `${action.name}: Granted ${tempHp} temporary hit points to ${targetList}.`;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name}, granting ${tempHp} temporary hit points to ${targetList}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[vitalityOfTheTree] Error logging to campaign log:', e); });

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

async function handleBolsteringTreats(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const treatUsesKey = 'chefBolsteringTreats';
    const craftCount = auto.craftCount === 'proficiency_bonus'
        ? (playerStats.proficiency || 0)
        : evaluateAutoExpression(auto.craftCount, playerStats);

    const tempHpAmount = auto.tempHpExpression === 'proficiency_bonus'
        ? (playerStats.proficiency || 0)
        : evaluateAutoExpression(auto.tempHpExpression, playerStats);

    if (typeof tempHpAmount !== 'number' || tempHpAmount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: Could not calculate temp HP.`,
                automation: auto,
            },
        };
    }

    const currentTreats = Number(getRuntimeValue(playerName, treatUsesKey) ?? craftCount);
    if (currentTreats <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name}: No treats remaining. Craft more with 1 hour of work or after a Long Rest.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, treatUsesKey, currentTreats - 1, campaignName);

    setTempHp(playerName, tempHpAmount, campaignName);

    const description = `${action.name}: Ate a bolstering treat, gaining ${tempHpAmount} temporary hit points. (${currentTreats - 1} treat${currentTreats - 1 !== 1 ? 's' : ''} remaining).`;

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

export function craftBolsteringTreats(playerStats, campaignName) {
    const treatUsesKey = 'chefBolsteringTreats';
    const craftCount = playerStats.proficiency || 0;
    setRuntimeValue(playerStats.name, treatUsesKey, craftCount, campaignName);
}
