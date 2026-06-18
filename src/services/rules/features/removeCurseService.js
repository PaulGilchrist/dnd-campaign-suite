import { executeHandler, applyRemoveCurseEffect } from '../../automation/index.js';

export async function triggerRemoveCurse(spell, metaCtx, playerStats, campaignName, mapName) {
    const isRemoveCurse = (spell.name || '').toLowerCase() === 'remove curse';
    if (!isRemoveCurse) return null;

    const action = {
        name: 'Remove Curse',
        automation: {
            type: 'remove_curse',
            range: spell.range || 'Touch',
        },
        spell,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[removeCurse] Failed to execute Remove Curse handler:', e);
        return null;
    }
}

export async function confirmRemoveCurse(action, playerStats, campaignName, mapName, result) {
    try {
        const appliedResult = await applyRemoveCurseEffect(action, playerStats, campaignName, mapName, result);
        return appliedResult;
    } catch (e) {
        console.error('[removeCurse] Failed to apply Remove Curse effect:', e);
        return null;
    }
}
