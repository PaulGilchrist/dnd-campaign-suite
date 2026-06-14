import { executeHandler } from '../automation/index.js';

export async function triggerMassSuggestion(spell, metaCtx, playerStats, campaignName, mapName) {
    const isMassSuggestion = (spell.name || '').toLowerCase() === 'mass suggestion';
    if (!isMassSuggestion) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 6;

    const action = {
        name: spell.name,
        automation: {
            type: 'mass_suggestion',
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
        console.error(`[massSuggestionService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
