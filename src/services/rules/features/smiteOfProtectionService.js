import { executeHandler } from '../../automation/index.js';

const DIVINE_SMITE_NAME = 'Divine Smite';

export function isDivineSmite(spell) {
    return (spell.name || '').toLowerCase() === DIVINE_SMITE_NAME.toLowerCase();
}

export function getSmiteOfProtectionPassives(playerStats) {
    const passives = (() => {
        const x = playerStats.automation?.passives;
        if (x == null) { console.error('[smiteOfProtectionService] Missing array:', x); throw new Error('Expected array, got ' + x); }
        return x;
    })();
    return passives.filter(p => p.type === 'post_cast_smite_cover');
}

export function hasSmiteOfProtection(playerStats) {
    return getSmiteOfProtectionPassives(playerStats).length > 0;
}

export async function triggerSmiteOfProtection(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!isDivineSmite(spell)) {
        return null;
    }

    if (!(metaCtx?.slotLevel > 0) && !(spell.level > 0)) {
        return null;
    }

    const smiteCovers = getSmiteOfProtectionPassives(playerStats);
    if (smiteCovers.length === 0) {
        return null;
    }

    const results = [];
    for (const smiteCover of smiteCovers) {
        const action = {
            name: smiteCover.name,
            automation: {
                type: 'post_cast_smite_cover',
                casting_time: smiteCover.casting_time || 'passive',
            },
        };

        try {
            const result = await executeHandler(action, playerStats, campaignName, mapName);
            if (result) {
                results.push(result);
            }
        } catch (e) {
            console.error(`[smiteOfProtection] Failed to execute smite cover for ${smiteCover.name}:`, e);
        }
    }

    return results.length > 0 ? results : null;
}
