import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { findLastAttack } from '../../common/damageRollback.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Protective Field';
    const usesKey = 'psionicEnergy';
    const defaultMax = playerStats._trackedResources?.[usesKey]?.max || 6;
    const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? defaultMax);

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: No Psionic Energy remaining. Recharges on a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    const attackResult = await findLastAttack(campaignName);
    const defenderName = attackResult?.attackEvent?.targetName || null;

    const psionicDieSize = evaluateAutoExpression('psionic_energy_die', playerStats);
    const dieRoll = rollExpression(`1d${psionicDieSize}`);
    const dieValue = dieRoll?.total || psionicDieSize;
    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0;
    const reduction = dieValue + intMod;

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    if (defenderName && reduction > 0) {
        const combatSummary = await getCombatContext(campaignName);
        if (combatSummary) {
            applyHealingToTarget(combatSummary, defenderName, reduction, campaignName);
        }
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} to reduce damage by ${reduction} (Rolled ${psionicDieSize} for ${dieValue} + INT ${intMod}).${defenderName ? ` Damage reduced to ${defenderName}.` : ''}`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName}: Reduce damage by <strong>${reduction}</strong> (Rolled ${psionicDieSize} for ${dieValue} + INT ${intMod}). Psionic Energy: ${currentUses - 1}/${defaultMax}.${defenderName ? ` Damage to ${defenderName} reduced.` : ''}`,
            automation: auto,
        },
    };
}
