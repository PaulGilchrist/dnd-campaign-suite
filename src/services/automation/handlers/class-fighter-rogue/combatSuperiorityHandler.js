import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';

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

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;

    const saveDc = buildSaveDc(auto, playerStats);
    const superiorityDieSize = evaluateAutoExpression(auto.dieExpression || 'superiority_die', playerStats);
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
                name: action.name,
                description: `${action.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    const options = auto.options || [];
    if (options.length > 0) {
        return {
            type: 'modal',
            modalName: 'combatSuperiority',
            payload: {
                action,
                playerStats,
                campaignName,
                mapName,
                saveDc,
                superiorityDieSize: Number(superiorityDieSize) || 8,
                relentless,
                relentlessUsed: relentlessUsed || false,
            },
        };
    }

    return executeManeuver(action, playerStats, campaignName, mapName, saveDc, superiorityDieSize, defaultMax, relentless, relentlessUsed || false);
}

async function executeManeuver(action, playerStats, campaignName, mapName, saveDc, superiorityDieSize, defaultMax, relentless, relentlessUsed) {
    const auto = action.automation;
    const usesKey = 'superiorityDice';
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? defaultMax);

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

    let description = `${action.name}: ${dieDescription}`;

    if (targetName) {
        description += ` Target: ${targetName}.`;
    }

    if (auto.damageExpression) {
        const damageRoll = rollExpression(auto.damageExpression);
        if (damageRoll) {
            description += ` Damage: ${damageRoll.total}.`;
        }
    }

    if (auto.conditionInflicted) {
        description += ` Target must make ${auto.saveType || 'WIS'} save DC ${saveDc} or gain ${auto.conditionInflicted} condition.`;
    }

    if (auto.effect) {
        description += ` Effect: ${auto.effect}.`;
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
