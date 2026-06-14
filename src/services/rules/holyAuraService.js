import { executeHandler } from '../automation/index.js';
import { setRuntimeValue } from '../../hooks/useRuntimeState.js';

export async function triggerHolyAura(spell, metaCtx, playerStats, campaignName, mapName) {
    const spellSaveDc = playerStats.spellAbilities?.saveDc || 8 + playerStats.proficiency;
    const action = {
        name: 'Holy Aura',
        automation: {
            type: 'holy_aura',
            duration: spell.duration || '1_minute',
            auraRange: 30,
            casting_time: spell.casting_time || '1 action',
        },
        spell,
        dc: spellSaveDc,
    };

    setRuntimeValue(playerStats.name, 'holyAuraSaveDc', spellSaveDc, campaignName);

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[holyAura] Trigger failed:', e);
        return null;
    }
}
