import { executeHandler } from '../../automation/index.js';

export async function triggerCommand({ spell, commandChoice, metaCtx, playerStats, campaignName, mapName }) {
    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 1;

    const action = {
        name: spell.name,
        automation: {
            type: 'command',
            commandChoice,
            saveDc: spellSaveDc,
            saveType: 'WIS',
        },
        spell,
        spellSlotLevel: slotLevel,
        metaCtx,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[commandService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
