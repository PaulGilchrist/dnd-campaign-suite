// BUG CLA-099: shared retirement seam for the 2024 Draconic Sorcery Dragon Wings
// self-buff. One choke point for the RAW end clauses — retracted (re-click the
// active row, verified affordance) and the 1-hour duration clock — so every path
// strips the buff, clears the active flag, and logs (project rule: every
// automation logs). The once-per-Long-Rest use is NOT refunded on retire; it
// stands at 0 until LONG_REST_RESOURCES re-arms dragonWingsUses (CLA-130 rule:
// any latch must be in LONG_REST_RESOURCES or the use dies permanently).
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

export const DRAGON_WINGS_BUFF_NAME = 'Dragon Wings';
export const DRAGON_WINGS_EFFECT = 'dragon_wings';
export const DRAGON_WINGS_USES_KEY = 'dragonWingsUses';
export const DRAGON_WINGS_ACTIVE_KEY = 'dragonWingsActive';

const END_LOG_TEXT = {
    expired: (name) => `${name}'s draconic wings dissolve — Dragon Wings' duration has expired.`,
    retracted: (name) => `${name} dismisses the draconic wings — Dragon Wings deactivated.`,
};

export function isDragonWingsBuff(buff) {
    return !!buff && buff.effect === DRAGON_WINGS_EFFECT && buff.name === DRAGON_WINGS_BUFF_NAME;
}

// '1_hour' → '1 hour' (CLA-099 F6: popups/logs rendered the raw enum).
export function formatWingsDuration(duration) {
    const match = String(duration || '').match(/^(\d+)_(rounds?|minutes?|hours?)$/i);
    if (!match) return duration || '';
    const n = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const label = unit.startsWith('hour') ? 'hour' : unit.startsWith('minute') ? 'minute' : 'round';
    return `${n} ${label}${n === 1 ? '' : 's'}`;
}

// Clears the active flag always (idempotent), removes the standing buff via one
// spread write, and logs the end reason. Returns true when a standing buff was
// taken down; false = no-op. The uses latch is deliberately untouched here —
// retiring the wings never refunds the once-per-Long-Rest use.
export function endDragonWingsBuff(characterName, campaignName, reason) {
    setRuntimeValue(characterName, DRAGON_WINGS_ACTIVE_KEY, false, campaignName);
    const stored = getRuntimeValue(characterName, 'activeBuffs', campaignName);
    const buffs = Array.isArray(stored) ? stored : [];
    const filtered = buffs.filter(b => !isDragonWingsBuff(b));
    if (filtered.length === buffs.length) return false;
    setRuntimeValue(characterName, 'activeBuffs', filtered, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName,
        abilityName: DRAGON_WINGS_BUFF_NAME,
        description: (END_LOG_TEXT[reason] || END_LOG_TEXT.retracted)(characterName),
        timestamp: Date.now(),
    }).catch((e) => { console.error('[dragonWingsService] Error:', e); });
    return true;
}
