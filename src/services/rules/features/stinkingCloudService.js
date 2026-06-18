import { executeHandler } from '../../automation/index.js';

export async function triggerStinkingCloud(spell, metaCtx, playerStats, campaignName, mapName) {
    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 3;

    const action = {
        name: spell.name,
        automation: {
            type: 'stinking_cloud',
            saveDc: spellSaveDc,
            saveType: 'CON',
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[stinkingCloudService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
