import { executeHandler } from '../../automation/index.js';

export async function triggerMassSuggestion(spell, metaCtx, playerStats, campaignName, mapName) {
    const isMassSuggestion = (spell.name || '').toLowerCase() === 'mass suggestion';
    if (!isMassSuggestion) return null;

    let spellSaveDc;
    if (metaCtx?.spellSaveDc == null) {
        if (playerStats.spellAbilities?.saveDc == null) {
          if (playerStats.proficiency == null) {
            console.error('[massSuggestionService] triggerMassSuggestion: playerStats.proficiency is missing')
            throw new Error('playerStats.proficiency is required for mass suggestion')
          }
          spellSaveDc = 8 + playerStats.proficiency;
        } else {
          spellSaveDc = playerStats.spellAbilities.saveDc;
        }
      } else {
        spellSaveDc = metaCtx.spellSaveDc;
      }
    if (metaCtx?.slotLevel == null && spell.level == null) {
        console.error('[massSuggestionService] triggerMassSuggestion: slot level is missing (metaCtx.slotLevel and spell.level)')
        throw new Error('slot level is required for mass suggestion')
      }
      const slotLevel = metaCtx?.slotLevel || spell.level;

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
