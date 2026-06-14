import { executeHandler } from '../automation/index.js';

export async function triggerPowerWordStun(spell, metaCtx, playerStats, campaignName, mapName) {
    const isPowerWordStun = (spell.name || '').toLowerCase() === 'power word stun';
    if (!isPowerWordStun) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 8;

    const action = {
        name: spell.name,
        automation: {
            type: 'power_word_stun',
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
        console.error(`[powerWordStunService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
