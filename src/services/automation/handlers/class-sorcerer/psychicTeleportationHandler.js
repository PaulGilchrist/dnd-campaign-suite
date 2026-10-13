import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { applyTeleportTokenMove } from '../../../combat/teleportService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Psychic Teleportation';
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

    const psionicDieSize = evaluateAutoExpression('psionic_energy_die', playerStats);
    const dieRoll = Math.floor(Math.random() * psionicDieSize) + 1;
    const teleportDistance = dieRoll * 10;

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    const description = `${featureName}: Expend 1 Psionic Energy to manifest a Psychic Blade, then throw it to an unoccupied space up to ${teleportDistance} feet away. Teleport to that space. Psionic Energy: ${currentUses - 1}/${defaultMax}.`;

    // L5-003 §8.1: when token-moving is enforced, the blade's target is the
    // selected combat target — teleport lands in the nearest legal unoccupied
    // space within the rolled distance. Off ⇒ moved:false, prose unchanged.
    const cs = getCombatSummary(campaignName);
    const anchor = getTargetFromAttacker(cs, playerName);
    const move = await applyTeleportTokenMove({
        campaignName,
        mapName: _mapName,
        creatureName: playerName,
        anchorName: anchor?.name || null,
        maxFeet: teleportDistance,
    });
    const finalDescription = move.moved
        ? `${description} Token moved (${move.from.gridX},${move.from.gridY}) → (${move.to.gridX},${move.to.gridY}) — ${Math.round(move.distanceFeet)} ft.`
        : description;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName}: Teleported up to ${teleportDistance} feet (Rolled ${psionicDieSize} for ${dieRoll} × 10). Psionic Energy: ${currentUses - 1}/${defaultMax}.${move.moved ? ` Token moved (${move.from.gridX},${move.from.gridY}) → (${move.to.gridX},${move.to.gridY}).` : ''}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[psychicTeleportation] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: finalDescription,
            automation: auto,
        },
    };
}
