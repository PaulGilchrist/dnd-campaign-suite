import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { loadCombatSummary } from '../../../../services/encounters/combatData.js';

// CLA-010: Arcane Charge's RAW trigger is "When you use Action Surge,
// teleport up to 30 feet before or after the additional action." The surge
// latch (actionSurgeUsedThisRound, CLA-004) IS the resource model — the
// feature is gated on it, fires once per surge-round, and logs every press
// (refusal AND teleport). Round reads MUST thread campaignName from a FRESH
// combat-summary (CLA-004 pattern); an unthreaded read pins round to 1.
async function surgeUsedThisRound(playerStats, campaignName) {
    const usedThisRound = getRuntimeValue(playerStats.name, 'actionSurgeUsedThisRound', campaignName);
    if (usedThisRound == null) return false;
    const cs = await loadCombatSummary(campaignName);
    const currentRound = cs?.round ?? 1;
    return Number(usedThisRound) === currentRound;
}

function arcaneChargePopup(action, auto, description, automationType) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType,
            description,
            automation: auto,
        },
    };
}

function refusal(action, playerName, campaignName, reason) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'arcane_charge_refused',
        name: action.name,
        description: `${action.name}: ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[arcaneChargeHandler:refusal-log-error]', e); });

    return arcaneChargePopup(action, action.automation, `${action.name} ${reason}`, 'arcane_charge_refused');
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const distance = auto.distance || '30 ft';

    if (!(await surgeUsedThisRound(playerStats, campaignName))) {
        return refusal(action, playerStats.name, campaignName, 'requires Action Surge used this turn.');
    }

    return {
        type: 'modal',
        modalName: 'arcaneCharge',
        payload: { action, playerStats, campaignName, distance },
    };
}

// The special-actions grid never flushes handler results — the modal's own
// confirm handler logs the teleport directly (CLA-004 refusal precedent:
// refusals via automation/arcane_charge_refused, resolutions via ability_use).
export async function confirmArcaneCharge(action, playerStats, campaignName) {
    const auto = action.automation;
    const distance = auto.distance || '30 ft';

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} uses ${action.name}: Teleported ${distance} to an unoccupied space you can see.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[arcaneChargeHandler:teleport-log-error]', e); });

    return arcaneChargePopup(
        action,
        auto,
        `${action.name}: Teleported ${distance} to an unoccupied space you can see.`,
        auto.type,
    );
}
