// BUG CLA-096: shared retirement seam for the 2024 Dragonborn Draconic Flight
// spectral-wing buff. One choke point for the three RAW end clauses —
// retracted (no action), Incapacitated, and the 10-minute duration clock —
// so every path both strips the buff and logs (project rule: every
// automation logs). Once used, the long-rest use flag stands until
// LONG_REST_RESOURCES re-arms it; retiring the wings never refunds the use.
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

export const DRACONIC_FLIGHT_BUFF_NAME = 'Draconic Flight';
export const DRACONIC_FLIGHT_EFFECT = 'fly_speed_equals_walk_speed';

const END_LOG_TEXT = {
    expired: (name) => `${name}'s spectral wings dissolve — Draconic Flight's 10 minutes have elapsed.`,
    incapacitated: (name) => `${name}'s spectral wings dissolve due to the Incapacitated condition.`,
    retracted: (name) => `${name} retracts the spectral wings (no action required) — Draconic Flight ends.`,
};

export function isDraconicFlightBuff(buff) {
    return !!buff && buff.effect === DRACONIC_FLIGHT_EFFECT && buff.name === DRACONIC_FLIGHT_BUFF_NAME;
}

// Removes the buff (single spread write, §39) and logs the end reason.
// Returns true when a standing buff was taken down; false = no-op.
export function endDraconicFlightBuff(characterName, campaignName, reason) {
    const stored = getRuntimeValue(characterName, 'activeBuffs', campaignName);
    const buffs = Array.isArray(stored) ? stored : [];
    const filtered = buffs.filter(b => !isDraconicFlightBuff(b));
    if (filtered.length === buffs.length) return false;
    setRuntimeValue(characterName, 'activeBuffs', filtered, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName,
        abilityName: DRACONIC_FLIGHT_BUFF_NAME,
        description: (END_LOG_TEXT[reason] || END_LOG_TEXT.retracted)(characterName),
        timestamp: Date.now(),
    }).catch((e) => { console.error('[draconicFlightService] Error:', e); });
    return true;
}
