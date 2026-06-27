import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Psychic Teleportation';
    const usesKey = 'psionicEnergy';
    const defaultMax = playerStats.resources?.[usesKey]?.max || 6;
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

    const psionicDieSize = evaluateAutoExpression('psionic_energy_die', playerStats);
    const dieRoll = Math.floor(Math.random() * psionicDieSize) + 1;
    const teleportDistance = dieRoll * 10;

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    const description = `${featureName}: Expend 1 Psionic Energy to manifest a Psychic Blade, then throw it to an unoccupied space up to ${teleportDistance} feet away. Teleport to that space. Psionic Energy: ${currentUses - 1}/${defaultMax}.`;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName}: Teleported up to ${teleportDistance} feet (Rolled ${psionicDieSize} for ${dieRoll} × 10). Psionic Energy: ${currentUses - 1}/${defaultMax}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[psychicTeleportation] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
        },
    };
}
