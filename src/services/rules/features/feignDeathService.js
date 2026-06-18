import { executeHandler } from '../../automation/index.js';

export async function triggerFeignDeath(spell, metaCtx, playerStats, campaignName, mapName) {
    const isFeignDeath = (spell.name || '').toLowerCase() === 'feign death';
    if (!isFeignDeath) return null;

    // The target is the player themselves or a willing creature they touched.
    // metaCtx.targetName is set by the caller (spellCastService) from getTargetInfo().
    const targetName = metaCtx?.targetName || playerStats.name;

    const action = {
        name: 'Feign Death',
        automation: {
            type: 'feign_death',
            targetName,
            duration: spell.duration || '1 hour',
        },
        spell,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[feignDeath] Failed to execute Feign Death handler:', e);
        throw e;
    }
}
