import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';

// CLA-405: Fleet Step (Warrior of the Open Hand lv11, 2024 classes.json:6900) —
// "When you take a Bonus Action other than Step of the Wind, you can also use
// Step of the Wind immediately after that Bonus Action." The classes.json row is
// prose-only (no automation key) and no generic router consumes one, so this is
// sanctioned consumer code on the verified SP-128 lane shape: a persisted,
// holder-keyed round latch (single source of truth) reactively surfaces a
// "Step of the Wind (Fleet Step)" row in CharBonusActions, which executes the
// canonical step_of_the_wind lane (same FP cost per data — stepOfTheWindHandler
// is the sole FP writer, CLA-333 Option A: auto-upgrade at FP>=1, free Dash at
// 0; no free casts fabricated). The latch is consumed on use, cleared at round
// wrap / initiative roll with the PLAYER_ROUND_LATCH_KEYS family (CLA-100) — it
// is NOT a LONG_REST_RESOURCES free-cast latch (CLA-130 rule: only
// _<Feature>_freeCastCount keys join that lane).
export const FLEET_STEP_GRANT_KEY = '_Fleet_Step_grantRound';
export const FLEET_STEP_ROW_NAME = 'Step of the Wind (Fleet Step)';

export function isFleetStepEligible(playerStats) {
    if (!playerStats || playerStats.rules !== '2024') return false;
    if (playerStats.class?.name !== 'Monk') return false;
    if (Number(playerStats.level || 0) < 11) return false;
    const level = Number(playerStats.level || 0);
    const major = playerStats.class?.major || playerStats.class?.subclass;
    if ((major?.features || []).some(f => f?.name === 'Fleet Step' && Number(f?.level || 0) <= level)) return true;
    const lists = ['bonusActions', 'actions', 'features', 'passives', 'reactions', 'specialActions'];
    return lists.some(k => (Array.isArray(playerStats[k]) ? playerStats[k] : []).some(f => f?.name === 'Fleet Step'));
}

export function isStepOfTheWindTrigger(actionName, auto) {
    return auto?.type === 'step_of_the_wind' || /Step of the Wind/.test(String(actionName || ''));
}

export async function grantFleetStep(playerStats, campaignName, triggerName, auto) {
    if (!isFleetStepEligible(playerStats)) return false;
    if (isStepOfTheWindTrigger(triggerName, auto)) return false;
    const currentRound = getCurrentCombatRound(campaignName);
    const pending = Number(getRuntimeValue(playerStats.name, FLEET_STEP_GRANT_KEY, campaignName) ?? -1);
    if (pending === currentRound) return false;
    await setRuntimeValue(playerStats.name, FLEET_STEP_GRANT_KEY, currentRound, campaignName);
    await addEntry(campaignName, {
        type: 'automation',
        characterName: playerStats.name,
        automationType: 'fleet_step_triggered',
        name: 'Fleet Step',
        description: `${playerStats.name} took the Bonus Action ${triggerName} — Fleet Step: Step of the Wind is available immediately after it (offered in Bonus Actions this turn).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[fleetStepService:log-error]', e); });
    return true;
}

export async function consumeFleetStep(playerStats, campaignName) {
    const currentRound = getCurrentCombatRound(campaignName);
    const pending = Number(getRuntimeValue(playerStats.name, FLEET_STEP_GRANT_KEY, campaignName) ?? -1);
    if (pending !== currentRound) {
        await addEntry(campaignName, {
            type: 'automation',
            characterName: playerStats.name,
            automationType: 'fleet_step_refused',
            name: FLEET_STEP_ROW_NAME,
            description: `${FLEET_STEP_ROW_NAME} refused — no_grant_pending: no Fleet Step grant is pending this round.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[fleetStepService:log-error]', e); });
        return false;
    }
    await setRuntimeValue(playerStats.name, FLEET_STEP_GRANT_KEY, null, campaignName);
    await addEntry(campaignName, {
        type: 'automation',
        characterName: playerStats.name,
        automationType: 'fleet_step_used',
        name: FLEET_STEP_ROW_NAME,
        description: `${playerStats.name} consumed the Fleet Step grant to use Step of the Wind.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[fleetStepService:log-error]', e); });
    return true;
}
