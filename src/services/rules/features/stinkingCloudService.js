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
        // metaCtx.characters: the caller's roster (App computedCharacters),
        // transported like the charm-person lane and forwarded as the handler's
        // 5th arg — the cast-time immunity gate (handle signature).
        const result = await executeHandler(action, playerStats, campaignName, mapName, metaCtx?.characters);
        return result;
    } catch (e) {
        console.error(`[stinkingCloudService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
