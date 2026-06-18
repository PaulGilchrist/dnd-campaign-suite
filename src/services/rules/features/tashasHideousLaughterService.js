import { executeHandler } from '../../automation/index.js';

export async function triggerTashasHideousLaughter(spell, metaCtx, playerStats, campaignName, mapName) {
    const isTashasHideousLaughter = (spell.name || '').toLowerCase() === "tasha's hideous laughter";
    if (!isTashasHideousLaughter) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 1;

    const action = {
        name: spell.name,
        automation: {
            type: 'tashas_laughter',
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
        console.error(`[tashasHideousLaughter] Failed to execute ${spell.name} handler:`, e);
        throw e;
    }
}
