import { executeHandler } from '../automation/index.js';

export async function triggerFear(spell, metaCtx, playerStats, campaignName, mapName) {
    const isFear = (spell.name || '').toLowerCase() === 'fear';
    if (!isFear) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 3;

    const action = {
        name: 'Fear',
        automation: {
            type: 'fear',
            saveDc: spellSaveDc,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[fearService] Failed to execute Fear handler:', e);
        return null;
    }
}
