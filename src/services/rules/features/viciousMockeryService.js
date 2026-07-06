import { executeHandler } from '../../automation/index.js';

export async function triggerViciousMockeryForGeneric(spell, metaCtx, playerStats, campaignName, mapName) {
    const action = {
        name: 'Vicious Mockery',
        spell: spell,
        automation: {
            type: 'vicious_mockery',
            targetName: metaCtx?.targetName || 'Unknown',
        },
    };

    try {
        await executeHandler(action, playerStats, campaignName, mapName);
    } catch (e) {
        console.error('[viciousMockery] Trigger failed:', e);
        throw e;
    }
}
