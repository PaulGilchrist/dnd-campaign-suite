import { executeHandler } from '../../automation/index.js';

export async function triggerSeeInvisibility(spell, metaCtx, playerStats, campaignName, mapName) {
    const isSeeInvisibility = (spell.name || '').toLowerCase() === 'see invisibility';
    if (!isSeeInvisibility) return null;

    const action = {
        name: 'See Invisibility',
        automation: {
            type: 'temp_buff',
            effect: 'see_invisibility',
            duration: '1_hour',
            action: 'action',
            casting_time: '1 action',
        },
        spell,
        spellSlotLevel: spell.level || 2,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[seeInvisibility] Failed to execute See Invisibility handler:', e);
        throw e;
    }
}
