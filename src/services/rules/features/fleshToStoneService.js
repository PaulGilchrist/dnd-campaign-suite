import { executeHandler } from '../../automation/index.js';

export async function triggerFleshToStone(spell, metaCtx, playerStats, campaignName, mapName) {
    const isFleshToStone = (spell.name || '').toLowerCase() === 'flesh to stone';
    if (!isFleshToStone) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 6;

    const action = {
        name: 'Flesh to Stone',
        automation: {
            type: 'flesh_to_stone',
            saveDc: spellSaveDc,
            saveType: 'CON',
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[fleshToStoneService] Failed to execute Flesh to Stone handler:', e);
        return null;
    }
}
