import { executeHandler } from '../../automation/index.js';

export async function triggerHypnoticPattern(spell, metaCtx, playerStats, campaignName, mapName) {
    const isHypnoticPattern = (spell.name || '').toLowerCase() === 'hypnotic pattern';
    if (!isHypnoticPattern) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 3;

    const action = {
        name: spell.name,
        automation: {
            type: 'hypnotic_pattern',
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
        console.error(`[hypnoticPatternService] Failed to execute ${spell.name} handler:`, e);
        throw e;
    }
}
