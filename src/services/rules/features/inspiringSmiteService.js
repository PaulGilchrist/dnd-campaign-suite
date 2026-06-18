import { executeHandler } from '../../automation/index.js';

const DIVINE_SMITE_NAME = 'Divine Smite';

export function isDivineSmite(spell) {
    return (spell.name || '').toLowerCase() === DIVINE_SMITE_NAME.toLowerCase();
}

export function getInspiringSmitePassives(playerStats) {
    const passives = (() => {
        const x = playerStats.automation?.passives;
        if (x == null) { console.error('[inspiringSmiteService] Missing array:', x); throw new Error('Expected array, got ' + x); }
        return x;
    })();
    return passives.filter(p => p.type === 'post_cast_inspiring_smite');
}

export function hasInspiringSmite(playerStats) {
    return getInspiringSmitePassives(playerStats).length > 0;
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
        }
    }

    return results.length > 0 ? results : null;
}
