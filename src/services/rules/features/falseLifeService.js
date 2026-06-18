import { executeHandler } from '../../automation/index.js';

export async function triggerFalseLife(spell, metaCtx, playerStats, campaignName, mapName) {
    const isFalseLife = (spell.name || '').toLowerCase() === 'false life';
    if (!isFalseLife) return null;

    const slotLevel = metaCtx?.slotLevel || spell.level || 1;

    const action = {
        name: 'False Life',
        automation: {
            type: 'false_life',
            tempHpExpression: '2d4+4',
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[falseLife] Failed to execute False Life handler:', e);
        throw e;
    }
}
