import { executeHandler } from '../../automation/index.js';

export async function triggerSleep(spell, metaCtx, playerStats, campaignName, mapName) {
    let spellSaveDc;
    if (metaCtx?.spellSaveDc == null) {
        if (playerStats.spellAbilities?.saveDc == null) {
          if (playerStats.proficiency == null) {
            console.error('[sleepService] triggerSleep: playerStats.proficiency is missing')
            throw new Error('playerStats.proficiency is required for sleep spell')
          }
          spellSaveDc = 8 + playerStats.proficiency;
        } else {
          spellSaveDc = playerStats.spellAbilities.saveDc;
        }
      } else {
        spellSaveDc = metaCtx.spellSaveDc;
      }

    const action = {
        name: spell.name,
        automation: {
            type: 'sleep',
            saveDc: spellSaveDc,
            saveType: 'WIS',
        },
        spell,
        spellSlotLevel: (() => {
            if (metaCtx?.slotLevel == null && spell.level == null) {
                console.error('[sleepService] triggerSleep: slot level is missing (metaCtx.slotLevel and spell.level)')
                throw new Error('slot level is required for sleep spell')
            }
            return metaCtx?.slotLevel || spell.level
        })(),
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[sleepService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
