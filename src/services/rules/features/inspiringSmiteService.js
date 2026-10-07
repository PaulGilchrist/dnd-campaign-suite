import { executeHandler } from '../../automation/index.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isDivineSmite } from './spellUtils.js';

export function getInspiringSmitePassives(playerStats) {
    const passives = (() => {
        const x = playerStats.automation?.passives;
        if (x == null) { console.error('[inspiringSmiteService] Missing array:', x); throw new Error('Expected array, got ' + x); }
        return x;
    })();
    return passives.filter(p => p.type === 'post_cast_inspiring_smite');
}

export async function triggerInspiringSmite(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!isDivineSmite(spell)) {
        return null;
    }

    if (!(metaCtx?.slotLevel > 0) && !(spell.level > 0)) {
        return null;
    }

    const inspiringSmites = getInspiringSmitePassives(playerStats);
    if (inspiringSmites.length === 0) {
        return null;
    }

    // CLA-200: stamp a fresh per-cast arm token BEFORE the handler runs.
    // Each Divine Smite cast re-arms Inspiring Smite; the consumed latch
    // (inspiringSmiteUsedToken) is compared against this token by the
    // handler so a single cast can only ever fund one distributor.
    await setRuntimeValue(playerStats.name, 'inspiringSmiteCastToken', Date.now(), campaignName);

    const results = [];
    for (const inspiringSmite of inspiringSmites) {
        const action = {
            name: inspiringSmite.name,
            automation: {
                type: 'post_cast_inspiring_smite',
                casting_time: inspiringSmite.casting_time || 'passive',
            },
        };

        try {
            const result = await executeHandler(action, playerStats, campaignName, mapName);
            if (result) {
                results.push(result);
            }
        } catch (e) {
            console.error(`[inspiringSmite] Failed to execute inspiring smite for ${inspiringSmite.name}:`, e);
            throw e;
        }
    }

    return results.length > 0 ? results : null;
}
