import { executeHandler } from '../../automation/index.js';

export async function triggerSlow(spell, metaCtx, playerStats, campaignName, mapName) {
    const isSlow = (spell.name || '').toLowerCase() === 'slow';
    if (!isSlow) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 3;

    const action = {
        name: spell.name,
        automation: {
            type: 'slow',
            saveDc: spellSaveDc,
            saveType: 'WIS',
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[slowService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
