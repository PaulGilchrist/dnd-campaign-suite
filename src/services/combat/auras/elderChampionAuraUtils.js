import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAuraRangeFromStats } from './auraOfProtection.js';

const ELDER_CHAMPION_KEY = 'elderChampionActive';

export async function getElderChampionSaveDisadvantage({ attackerName, attackerStats, targetName }) {
    if (!attackerStats) return { disadvantage: false };
    if (!getRuntimeValue(attackerName, ELDER_CHAMPION_KEY)) return { disadvantage: false };

    const storedAllies = getRuntimeValue(attackerName, 'selectedAllies');
    if (Array.isArray(storedAllies) && storedAllies.length > 0 && storedAllies.includes(targetName)) {
        return { disadvantage: false };
    }

    const range = getAuraRangeFromStats(attackerStats);
    try {
        const inRange = await isWithinRange(attackerName, targetName, range);
        if (inRange) return { disadvantage: true, source: attackerName };
    } catch {
        // no-op — fallback to no disadvantage
    }

    return { disadvantage: false };
}
