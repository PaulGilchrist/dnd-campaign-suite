import { executeHandler, applyAidEffect } from '../../automation/index.js';

export async function triggerAidSpell(spell, metaCtx, playerStats, campaignName, mapName) {
    const isAid = (spell.name || '').toLowerCase() === 'aid';
    if (!isAid) return null;

    const slotLevel = metaCtx?.slotLevel || spell.level || 2;

    const action = {
        name: 'Aid',
        automation: {
            type: 'aid',
            range: spell.range || '30 feet',
            maxTargets: 3,
            hpMaxIncreaseExpression: '5 + ((spellSlotLevel - 2) * 5)',
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[aidSpell] Failed to execute Aid handler:', e);
        throw e;
    }
}

export async function confirmAidSpell(action, playerStats, campaignName, mapName, targetNames) {
    try {
        const result = await applyAidEffect(action, playerStats, campaignName, mapName, targetNames);
        return result;
    } catch (e) {
        console.error('[aidSpell] Failed to apply Aid effect:', e);
        throw e;
    }
}
