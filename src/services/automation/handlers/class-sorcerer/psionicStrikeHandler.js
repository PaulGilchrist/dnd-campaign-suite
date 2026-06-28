import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { loadCombatSummary } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const usesKey = auto.resource || 'psionicEnergy';
    const defaultMax = playerStats._trackedResources?.[usesKey]?.max || 6;
    const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? defaultMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No Psionic Energy remaining. Recharges on a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    const oncePerTurn = auto.oncePerTurn;
    if (oncePerTurn) {
        const turnUsed = getRuntimeValue(playerName, 'psionicStrikeUsedThisTurn', campaignName);
        const currentTurn = getRuntimeValue(playerName, 'currentTurn', campaignName) || 'unknown';
        if (turnUsed && turnUsed === currentTurn) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name}: Already used this turn. Once per turn.`,
                    automation: auto,
                },
            };
        }
    }

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No target available. Select a creature in combat and try again.`,
                automation: auto,
            },
        };
    }

    const psionicDieSize = evaluateAutoExpression('psionic_energy_die', playerStats);
    const dieRoll = rollExpression(`1d${psionicDieSize}`);
    const dieValue = dieRoll?.total || psionicDieSize;
    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0;
    const totalDamage = dieValue + intMod;

    const combatSummary = await loadCombatSummary(campaignName);
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    applyDamageToTarget(combatSummary, targetName, totalDamage, ['Force'], campaignName, characters, false, playerName);

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    if (oncePerTurn) {
        const currentTurn = getRuntimeValue(playerName, 'currentTurn', campaignName) || 'unknown';
        await setRuntimeValue(playerName, 'psionicStrikeUsedThisTurn', currentTurn, campaignName);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to deal ${totalDamage} Force damage to ${targetName} (Rolled ${psionicDieSize} for ${dieValue} + INT ${intMod}).`,
    }).catch(() => {});

    await addEntry(campaignName, {
        type: 'damage_roll',
        characterName: playerName,
        targetName,
        damageType: 'Force',
        total: totalDamage,
        formula: `${psionicDieSize} + ${intMod}`,
        description: `${action.name} dealt ${totalDamage} Force damage to ${targetName}.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            targetName,
            description: `${action.name}: Dealt <strong>${totalDamage}</strong> Force damage to ${targetName}. (Rolled ${psionicDieSize} for ${dieValue} + INT ${intMod}). Psionic Energy: ${currentUses - 1}/${defaultMax}.`,
            automation: auto,
        },
    };
}
