import { executeHandler } from '../../automation/index.js';

export async function triggerOttoDance(spell, metaCtx, playerStats, campaignName, mapName) {
    const isOttoDance = (spell.name || '').toLowerCase() === "otto's irresistible dance" || (spell.name || '').toLowerCase() === 'irresistible dance';
    if (!isOttoDance) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 6;

    const action = {
        name: spell.name,
        automation: {
            type: 'ottos_dance',
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
        console.error(`[ottoDanceService] Failed to execute ${spell.name} handler:`, e);
        throw e;
    }
}
