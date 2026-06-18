import { executeHandler } from '../../automation/index.js';

export async function triggerHypnoticPattern(spell, metaCtx, playerStats, campaignName, mapName) {
    const isHypnoticPattern = (spell.name || '').toLowerCase() === 'hypnotic pattern';
    if (!isHypnoticPattern) return null;

    let spellSaveDc;
    if (metaCtx?.spellSaveDc == null) {
        if (playerStats.spellAbilities?.saveDc == null) {
          if (playerStats.proficiency == null) {
            console.error('[hypnoticPatternService] triggerHypnoticPattern: playerStats.proficiency is missing')
            throw new Error('playerStats.proficiency is required for hypnotic pattern')
          }
          spellSaveDc = 8 + playerStats.proficiency;
        } else {
          spellSaveDc = playerStats.spellAbilities.saveDc;
        }
      } else {
        spellSaveDc = metaCtx.spellSaveDc;
      }
    if (metaCtx?.slotLevel == null && spell.level == null) {
        console.error('[hypnoticPatternService] triggerHypnoticPattern: slot level is missing (metaCtx.slotLevel and spell.level)')
        throw new Error('slot level is required for hypnotic pattern')
      }
      const slotLevel = metaCtx?.slotLevel || spell.level;

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
        return null;
    }
}
