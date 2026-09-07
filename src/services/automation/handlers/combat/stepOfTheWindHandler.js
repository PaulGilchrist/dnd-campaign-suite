import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { handle as handleDestructiveStride } from './destructiveStrideHandler.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const isHeightened = action.name === 'Heightened Step of the Wind';

    const cost = auto.cost?.amount || 1;
    const maxFocus = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points || 0;
    const currentFocus = Number(getRuntimeValue(playerName, 'focusPoints', campaignName) ?? maxFocus);

    // CLA-333 Option A: RAW is "Take Dash as Bonus Action, OR expend 1 Focus Point for
    // Disengage + Dash with doubled jump distance". The base Dash is a free Bonus Action
    // and is ALWAYS available; the Focus Point spend is the opt-in upgrade to Disengage.
    // We auto-upgrade when Focus Points are available (patient_defense auto-upgrade
    // pattern) and fall back to the free Dash at 0 — a Monk is never refused, since the
    // base Dash costs nothing. (Limitation: a Monk cannot opt to keep FP at FP>=1; the
    // app auto-spends — accepted for Option A.)
    const expend = currentFocus >= cost;
    const focusRemaining = currentFocus - (expend ? cost : 0);

    if (expend) {
        await setRuntimeValue(playerName, 'focusPoints', focusRemaining, campaignName);
        window.dispatchEvent(new CustomEvent('focus-points-updated'));

        // Disengage mechanical output (FP upgrade only): self-target no_opportunity_attacks
        // te until the start of your next turn (registry entry exists; consumed by
        // computeConditionEffects via riderCannotOpportunityAttack badges). CLA-333 —
        // mirrors the patientDefense Dodge expiration and executeManeuver self-te patterns.
        const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
        await setRuntimeValue('campaign', 'targetEffects', [
            ...storedEffects,
            { target: playerName, source: action.name, effect: 'no_opportunity_attacks', value: null, duration: 'until_start_of_next_turn' },
        ], campaignName);
        addExpiration(playerName, playerName, [
            { type: 'remove_target_effect', effectKey: 'no_opportunity_attacks', source: action.name, target: playerName },
        ], campaignName, undefined, playerName);
    }

    let description;
    let logDesc;
    if (expend) {
        description = `${playerName} expended 1 Focus Point on ${action.name}: Disengage + Dash as a bonus action, doubled jump distance.`;
        if (isHeightened) {
            description += ' Moving a willing creature within 5 feet (Large or smaller) with you.';
        }
        description += ` (${focusRemaining} Focus Points remaining).`;
        logDesc = `${playerName} spent 1 Focus Point on ${action.name}: Disengage + Dash as a bonus action (no Opportunity Attacks against you until the start of your next turn); jump distance doubled`;
        if (isHeightened) {
            logDesc += ', moving a willing creature within 5 feet (Large or smaller) with you';
        }
    } else {
        // Free base Dash — no Focus Point available, so no Disengage and no doubled jump.
        description = `${playerName} used ${action.name}: Dash as a Bonus Action (free — no Focus Point available to expend for Disengage + doubled jump).`;
        logDesc = `${playerName} used ${action.name} to Dash as a bonus action (free; no Focus Point available, so no Disengage or doubled jump)`;
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: logDesc,
    }).catch((e) => { console.error("[stepOfTheWindHandler:log-error]", e); });

    const epitomeActive = getRuntimeValue(playerName, 'elementalEpitomeActive', campaignName);
    if (epitomeActive) {
        const destructiveStrideFeature = playerStats.specialActions?.find(f => f.name === 'Destructive Stride');
        if (destructiveStrideFeature) {
            const result = await handleDestructiveStride(destructiveStrideFeature, playerStats, campaignName);
            if (result) {
                return result;
            }
        }
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: description,
            automation: auto,
        },
    };
}
