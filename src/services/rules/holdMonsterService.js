import { executeHandler } from '../automation/index.js';

const HOLD_SPELL_NAMES = new Set(['hold monster', 'hold person']);

export async function triggerHoldMonster(spell, metaCtx, playerStats, campaignName, mapName) {
    const spellName = (spell.name || '').toLowerCase();
    if (!HOLD_SPELL_NAMES.has(spellName)) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 5;

    const action = {
        name: spell.name,
        automation: {
            type: 'hold_monster',
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
        console.error(`[holdMonsterService] Failed to execute ${spell.name} handler:`, e);
        return null;
    }
}
