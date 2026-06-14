import { executeHandler, applyGreaterRestorationEffect } from '../automation/index.js';

export async function triggerGreaterRestoration(spell, metaCtx, playerStats, campaignName, mapName) {
    const isGreaterRestoration = (spell.name || '').toLowerCase() === 'greater restoration';
    if (!isGreaterRestoration) return null;

    const action = {
        name: 'Greater Restoration',
        automation: {
            type: 'greater_restoration',
            range: spell.range || 'Touch',
        },
        spell,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[greaterRestoration] Failed to execute Greater Restoration handler:', e);
        return null;
    }
}

export async function confirmGreaterRestoration(action, playerStats, campaignName, mapName, result) {
    try {
        const appliedResult = await applyGreaterRestorationEffect(action, playerStats, campaignName, mapName, result);
        return appliedResult;
    } catch (e) {
        console.error('[greaterRestoration] Failed to apply Greater Restoration effect:', e);
        return null;
    }
}
