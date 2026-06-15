import { executeHandler } from '../../automation/index.js';

export async function triggerSleep(spell, metaCtx, playerStats, campaignName, mapName) {
    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);

    const action = {
        name: spell.name,
        automation: {
            type: 'sleep',
            saveDc: spellSaveDc,
            saveType: 'WIS',
        },
        spell,
        spellSlotLevel: metaCtx?.slotLevel || spell.level || 1,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[sleepService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
