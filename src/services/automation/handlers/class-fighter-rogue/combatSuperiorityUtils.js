import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { setTempHp } from '../buffs/tempHpService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { addCondition } from '../../../../services/combat/conditions/conditionSaveService.js';
import { loadManeuvers } from '../../../ui/dataLoader.js';
import { computeSuperiorityDiceMax } from '../../../rules/trackedResources.js';

export function applyConditionToTarget(targetName, conditionKey, campaignName, combatSummary, saveDc, saveType, playerStats) {
    if (!combatSummary) {
        console.error(`[combatSuperiority] Failed to get combatSummary for applying ${conditionKey} to ${targetName}`);
        return;
    }
    const conditionDef = { key: conditionKey, label: conditionKey.charAt(0).toUpperCase() + conditionKey.slice(1) };
    addCondition({ combatSummary, creatureName: targetName, conditionDef, dc: saveDc, ability: saveType, getRuntimeValue, setRuntimeValue, campaignName, playerStats });
}

export function hasRelentless(playerStats) {
    return (playerStats.automation?.passives || []).some(p => p.type === 'passive_rule' && p.effect === 'relentless');
}

export function getRelentlessUsedRound(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, 'relentlessUsedRound', campaignName);
}

export function setRelentlessUsed(playerStats, campaignName, currentRound) {
    const round = currentRound ?? getCurrentCombatRound(campaignName);
    setRuntimeValue(playerStats.name, 'relentlessUsedRound', round, campaignName);
}

export function getKnownManeuvers(playerStats, campaignName) {
    const stored = getRuntimeValue(playerStats.name, 'BattleMasterManeuvers_selection', campaignName);
    return Array.isArray(stored) ? stored : [];
}

// FS-010: when the runtime key is null (fresh mount or post-rest re-arm),
// derive the character's ACTUAL max — Battle Master level table or 1 for a
// pure Superior Technique fighter — never a flat 4 (a style-only fighter could
// otherwise fuel 4 maneuvers per short rest).
export function getMaxSuperiorityDice(playerStats) {
    const trackedMax = playerStats?._trackedResources?.superiorityDice?.max;
    if (trackedMax != null) return Number(trackedMax);
    return computeSuperiorityDiceMax(playerStats);
}

export function getSuperiorityDice(playerStats, campaignName) {
    const usesKey = 'superiorityDice';
    const stored = getRuntimeValue(playerStats.name, usesKey, campaignName);
    if (stored != null) return Number(stored);
    return getMaxSuperiorityDice(playerStats);
}

export function computeMaxOptions(playerStats, auto) {
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

export function rollManeuverDie(maneuver, playerStats, campaignName, featureDieExpression) {
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound(campaignName);
    // CLA-286: round-keyed self-re-arming latch (CLA-109 pattern) — free use
    // once per round; re-arms automatically when the round advances.
    const relentlessUsed = relentless && storedRound != null && Number(storedRound) >= Number(currentRound);

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    // FS-010: honor a concrete numeric die face supplied by the feature that
    // armed the roll (Superior Technique style grants '6'); the Battle Master
    // 'superiority_die' token stays level-table-driven.
    const explicitFace = Number(featureDieExpression);
    const superiorityDieSize = (Number.isFinite(explicitFace) && explicitFace > 0)
        ? explicitFace
        : evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);

    if (relentless && !relentlessUsed) {
        // CLA-286: canonical Relentless rolls a fixed d8, not the superiority die size.
        const relentlessRoll = rollExpression('1d8');
        dieValue = relentlessRoll?.total || 8;
        dieDescription = `Rolled d8 for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName, currentRound);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled d${superiorityDieSize} for ${dieValue}.`;
    }

    return { dieValue, dieDescription, expendedDie, relentlessUsed, superiorityDieSize };
}

export async function findManeuver(maneuverName, rules) {
    const allManeuvers = await loadManeuvers(rules || '2024');
    return allManeuvers.find(m => m.name === maneuverName) || null;
}

export function checkSuperiorityDice(playerStats, campaignName) {
    const superiorityDice = getSuperiorityDice(playerStats, campaignName);
    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound(campaignName);
    // CLA-286: mirror the self-re-arming latch used by rollManeuverDie.
    const relentlessUsed = relentless && storedRound != null && Number(storedRound) >= Number(currentRound);
    const hasDiceRemaining = superiorityDice > 0 || (relentless && !relentlessUsed);
    return { superiorityDice, relentless, relentlessUsed, hasDiceRemaining };
}

export async function expendSuperiorityDie(playerStats, campaignName, expendedDie, superiorityDice) {
    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', superiorityDice - 1, campaignName);
    }
}

export function buildManeuverNotFoundPopup(actionName, maneuverName) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: actionName,
            description: `Maneuver "${maneuverName}" not found.`,
        },
    };
}

export function buildNoDiceRemainingPopup(maneuverName) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuverName,
            description: `${maneuverName}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
        },
    };
}

export async function processManeuverSaveResult(maneuver, targetName, saveDc, success, playerStats, campaignName) {
    let description = '';
    if (!success) {
        if (maneuver.effect === 'frightened') {
            description += ` ${targetName} is Frightened until the end of your next turn.`;
            const cs = await getCombatContext(campaignName);
            applyConditionToTarget(targetName, 'frightened', campaignName, cs, saveDc, maneuver.saveType, playerStats);
            await addExpiration(playerStats.name, targetName, [
                { type: 'condition', condition: 'frightened' },
            ], campaignName, 2);
        } else if (maneuver.effect === 'disarm') {
            description += ` ${targetName} dropped the object it was holding.`;
        } else if (maneuver.effect === 'push') {
            const pushDistance = maneuver.value || 15;
            description += ` ${targetName} was pushed ${pushDistance} feet away.`;
            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: maneuver.name,
                description: `${playerStats.name} pushed ${targetName} ${pushDistance} feet away.`,
                targetName: targetName,
            }).catch((e) => { console.error("[combatSuperiorityUtils:log-error]", e); });
        } else if (maneuver.effect === 'goad') {
            description += ` ${targetName} has Disadvantage on attacks against targets other than you.`;
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const newEffect = {
                target: targetName,
                source: playerStats.name,
                effect: 'taunting_step',
                duration: 'until_end_of_user_next_turn',
            };
            const updatedEffects = [...storedEffects, newEffect];
            setRuntimeValue('campaign', 'targetEffects', updatedEffects, campaignName);
        } else if (maneuver.effect === 'prone') {
            description += ` ${targetName} fell Prone.`;
            const cs = await getCombatContext(campaignName);
            applyConditionToTarget(targetName, 'prone', campaignName, cs, saveDc, maneuver.saveType, playerStats);
        } else if (maneuver.conditionInflicted) {
            description += ` ${targetName} gained the ${maneuver.conditionInflicted} condition.`;
        } else {
            description += ` The effect was applied to ${targetName}.`;
        }
    }
    return description;
}

export function buildManeuverSaveDescription(maneuver, saveDc) {
    let description = ` Target must make a ${maneuver.saveType} save DC ${saveDc}`;
    if (maneuver.conditionInflicted) {
        description += ` or gain ${maneuver.conditionInflicted} condition`;
    } else if (maneuver.effect === 'disarm') {
        description += ` or drop one object it's holding`;
    } else if (maneuver.effect === 'push') {
        description += ` or be pushed ${maneuver.value || 15} feet away (no lingering effect)`;
    } else if (maneuver.effect === 'goad') {
        description += ` or have Disadvantage on attacks against targets other than you`;
    } else {
        description += ` or suffer the effect`;
    }
    description += '.';
    return description;
}

export { filterMeleeAttacks } from '../../../combat/filterMeleeAttacks.js';

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

    setTempHp(chosenName, totalHp, campaignName);

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

export async function executeSweepingAttack(action, playerStats, campaignName, secondaryTargetName) {
    const pendingData = getRuntimeValue(playerStats.name, 'pendingSweepingAttack', campaignName);

    if (!pendingData) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sweeping Attack',
                description: 'No pending data. Use from an attack rider.',
            },
        };
    }

    // MN-018: consume the pending payload up-front — a chooser confirm is one-shot.
    await setRuntimeValue(playerStats.name, 'pendingSweepingAttack', null, campaignName);

    const rawSecondary = Array.isArray(pendingData.secondaryTargets) ? pendingData.secondaryTargets : [];
    const secondaryTarget = rawSecondary.find(t => t && t.name === secondaryTargetName);
    if (!secondaryTarget) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Sweeping Attack',
                description: `${secondaryTargetName} is not a valid secondary target.`,
            },
        };
    }

    const dieValue = pendingData.dieValue;
    const targetName = pendingData.primaryTarget || pendingData.targetName;
    const damageType = pendingData.damageType || (console.error('[MN-018] Sweeping Attack: original attack damageType missing'), 'Slashing');

    // MN-018: reuse the ORIGINAL attack roll vs the SECOND creature's AC.
    const attackTotal = Number(pendingData.originalTotal)
        || ((Number(pendingData.originalD20Roll) || 0) + (Number(pendingData.attackBonus) || 0));
    const secondAc = Number(secondaryTarget.ac ?? secondaryTarget.armor_class ?? 10);

    // MN-018: 5 ft of the original target gate (gridless resolves LENIENT per §7 —
    // the gate is genuinely consulted the moment a positioned map exists).
    const inRange = await isWithinRange(targetName, secondaryTargetName, 5);

    let description;

    if (!inRange) {
        description = `${secondaryTargetName} is not within 5 feet of ${targetName || 'the original target'} — no creature is swept.`;
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Sweeping Attack',
            description: `Sweeping Attack: ${secondaryTargetName} is not within 5 feet of ${targetName || 'the original target'} — no damage.`,
        }).catch((e) => { console.error('[MN-018:log-error]', e); });
    } else if (attackTotal >= secondAc) {
        description = (await sweepSecondTarget({ playerStats, campaignName, secondaryTargetName, targetName, dieValue, damageType, attackTotal, secondAc })).description;
    } else {
        description = `Original attack roll ${attackTotal} vs AC ${secondAc} — misses ${secondaryTargetName}. No damage.`;
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Sweeping Attack',
            description: `Sweeping Attack: original attack roll ${attackTotal} vs AC ${secondAc} misses ${secondaryTargetName} — no damage.`,
        }).catch((e) => { console.error('[MN-018:log-error]', e); });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Sweeping Attack',
            description,
        },
        logEntries: [],
    };
}

// MN-018: original attack roll hits the second creature — apply damage,
// track the secondary_damage targetEffect, and log the hit.
async function sweepSecondTarget({ playerStats, campaignName, secondaryTargetName, targetName, dieValue, damageType, attackTotal, secondAc }) {
    const cs = await getCombatContext(campaignName);
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    const applyResult = await applyDamageToTarget(cs, secondaryTargetName, dieValue, [damageType], campaignName, characters, { ignoreResistance: false, attackerName: playerStats.name });
    const actualDamage = applyResult?.finalDamage ?? dieValue;

    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    storedEffects.push({
        target: secondaryTargetName,
        source: 'Sweeping Attack',
        option: 'Sweeping Attack',
        effect: 'secondary_damage',
        value: actualDamage,
        damageType: damageType,
        duration: 'instant',
        saveType: null,
        saveDc: null,
        saveAbility: null,
    });
    setRuntimeValue('campaign', 'targetEffects', storedEffects, campaignName);

    const description = `Original attack roll ${attackTotal} vs AC ${secondAc} hits ${secondaryTargetName}, which takes ${actualDamage} ${damageType} damage (same type as the original attack).`;
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Sweeping Attack',
        description: `Sweeping Attack: original attack roll ${attackTotal} vs AC ${secondAc} hits ${secondaryTargetName} — ${actualDamage} ${damageType} damage (same type as the attack on ${targetName || 'the original target'}).`,
    }).catch((e) => { console.error('[MN-018:log-error]', e); });

    return { description, actualDamage };
}
