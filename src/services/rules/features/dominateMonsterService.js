import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';

function dominateMonsterInfoPopup(description) {
    return { type: 'popup', payload: { type: 'automation_info', name: 'Dominate Monster', description } };
}

async function resolveDominateMonsterTarget(playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (cs?.creatures && cs.creatures.length > 0) {
        const attackerTarget = getTargetFromAttacker(cs, playerStats.name);
        if (attackerTarget) return attackerTarget.name;
    }
    console.error(`[dominateMonsterService] No target selected for Dominate Monster by ${playerStats.name}. Caster has no target in initiative view.`);
    return null;
}

async function targetIsNotFullHealth(targetName, campaignName) {
    const cs = await getCombatContext(campaignName);
    const targetCreature = cs?.creatures?.find(c => c.name === targetName);
    return targetCreature && targetCreature.currentHp != null && targetCreature.maxHp != null && targetCreature.currentHp < targetCreature.maxHp;
}

export async function triggerDominateMonster(spell, metaCtx, playerStats, campaignName, mapName) {
    if ((spell.name || '').toLowerCase() !== 'dominate monster') return null;

    const targetName = metaCtx?.targetName || await resolveDominateMonsterTarget(playerStats, campaignName);
    if (!targetName) {
        return dominateMonsterInfoPopup('No target selected for Dominate Monster.');
    }

    // Check if target is at full health to determine if target gets advantage on save
    const targetNotFullHealth = await targetIsNotFullHealth(targetName, campaignName);

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 8;

    const action = {
        name: 'Dominate Monster',
        automation: {
            type: 'dominate_monster',
            saveDc: spellSaveDc,
            targetName: targetName,
            advantage: targetNotFullHealth,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        return await executeHandler(action, playerStats, campaignName, mapName);
    } catch (e) {
        console.error('[dominateMonsterService] Failed to execute Dominate Monster handler:', e);
        return dominateMonsterInfoPopup('Failed to execute Dominate Monster.');
    }
}
