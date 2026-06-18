import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const usesKey = 'psionicEnergy';
    const defaultMax = playerStats.resources?.[usesKey]?.max || 6;
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

    const psionicDieSize = evaluateAutoExpression('psionic_energy_die', playerStats);
    const dieRoll = rollExpression(`1d${psionicDieSize}`);
    const dieValue = dieRoll?.total || psionicDieSize;
    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0;
    const reduction = dieValue + intMod;

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to reduce damage by ${reduction} (Rolled ${psionicDieSize} for ${dieValue} + INT ${intMod}).`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: Reduce damage by <strong>${reduction}</strong> (Rolled ${psionicDieSize} for ${dieValue} + INT ${intMod}). Psionic Energy: ${currentUses - 1}/${defaultMax}.`,
            automation: auto,
        },
    };
}
