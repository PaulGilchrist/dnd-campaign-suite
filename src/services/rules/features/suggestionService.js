import { executeHandler } from '../../automation/index.js';

export async function triggerSuggestion(spell, metaCtx, playerStats, campaignName, mapName) {
    const isSuggestion = (spell.name || '').toLowerCase() === 'suggestion';
    if (!isSuggestion) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 2;

    const action = {
        name: spell.name,
        automation: {
            type: 'suggestion',
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
        console.error(`[suggestionService] Failed to execute ${spell.name} handler:`, e);
        throw e;
    }
}
