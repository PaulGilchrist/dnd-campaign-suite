import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automationService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { addEntry } from '../../../ui/logService.js';

function getBardicDieSize(playerStats) {
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    return classLevel?.bardic_die || 6;
}

function getAbilityModifier(playerStats, abilityName) {
    const abil = playerStats.abilities?.find(a => a.name === abilityName);
    if (!abil) return 0;
    return Math.floor((abil.score - 10) / 2);
}

function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (auto.bonusMovement && auto.tempHpExpression && auto.tempHpExpression.includes('bardic_inspiration_die')) {
        return handleMantleOfInspiration(action, playerStats, campaignName, mapName);
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

    setRuntimeValue(playerName, 'tempHp', amount, campaignName);

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

async function handleMantleOfInspiration(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const bardicDieSize = getBardicDieSize(playerStats);
    const usesMax = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_inspiration_uses
        || getAbilityModifier(playerStats, 'Charisma');

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, 'bardicInspirationUses', campaignName) ?? usesMax);
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
    }

    const dieRoll = rollDie(bardicDieSize);
    const tempHp = 2 * dieRoll;

    const chaMod = getAbilityModifier(playerStats, 'Charisma');
    const maxTargets = Math.max(1, chaMod);

    const rangeFt = rangeToFeet(auto.range || '60 ft');
    const targets = [];

    if (mapName && rangeFt != null) {
        const attackerPlayer = await loadMapData(campaignName, mapName).then(md => md?.players?.find(p => p.name === playerName));
        if (attackerPlayer) {
            const attackerPos = { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY };
            const mapPlayers = (await loadMapData(campaignName, mapName))?.players || [];
            for (const p of mapPlayers) {
                if (p.name === playerName) continue;
                if (targets.length >= maxTargets) break;
                const pos = { gridX: p.gridX, gridY: p.gridY };
                const dist = getDistanceFeet(attackerPos, pos);
                if (dist != null && dist <= rangeFt) {
                    targets.push(p.name);
                }
            }
        }
    }

    for (const targetName of targets) {
        setRuntimeValue(targetName, 'tempHp', tempHp, campaignName);
        setRuntimeValue(targetName, 'inspiringMovementNoOA', true, campaignName);
        addExpiration(playerName, targetName, [
            { type: 'inspiring_movement_no_oa' }
        ], campaignName, 1);
    }

    const targetList = targets.length > 0 ? targets.join(', ') : 'no targets in range';
    const description = `${action.name}: Rolled ${dieRoll} (1d${bardicDieSize}), granting ${tempHp} temporary hit points to ${targetList}.` +
        (targets.length > 0 ? ' Each target can use their Reaction to move up to their Speed without provoking Opportunity Attacks.' : '');

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} (rolled ${dieRoll} on 1d${bardicDieSize} = ${tempHp} temp HP). Targets: ${targetList}`,
    }).catch(() => {});

    return {
        type: 'roll',
        payload: {
            roll: `1d${bardicDieSize}`,
            result: dieRoll,
            name: action.name,
            tempHp,
            targets,
            description,
        },
    };
}

export function grantTempHpOnRage(action, playerStats, campaignName) {
    const auto = action.automation;
    if (!auto.triggerOnRage) return false;

    const tempHpExpression = auto.tempHpExpression || '';
    if (!tempHpExpression) return false;

    const amount = evaluateAutoExpression(tempHpExpression, playerStats);
    if (typeof amount !== 'number' || amount <= 0) return false;

    const existing = getRuntimeValue(playerStats.name, 'tempHp', campaignName) || 0;
    const newTotal = Math.max(existing, amount);
    setRuntimeValue(playerStats.name, 'tempHp', newTotal, campaignName);

    return true;
}
