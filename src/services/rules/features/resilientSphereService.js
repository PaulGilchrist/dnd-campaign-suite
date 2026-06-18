import { executeHandler } from '../../automation/index.js';

export async function triggerResilientSphere(spell, metaCtx, playerStats, campaignName, mapName) {
    const name = (spell.name || '').toLowerCase();
    const isResilientSphere = name === "otiluke's resilient sphere" || name === 'resilient sphere';
    if (!isResilientSphere) return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 4;

    const action = {
        name: spell.name,
        automation: {
            type: 'resilient_sphere',
            saveDc: spellSaveDc,
            saveType: 'DEX',
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[resilientSphereService] Failed to execute ${spell.name} handler:`, e);
        throw e;
    }
}
