import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

/**
 * Determine if a target is not at full health (for save advantage).
 */
async function getTargetHealthAdvantage(targetName, campaignName) {
    const cs = await getCombatContext(campaignName);
    const targetCreature = cs?.creatures?.find(c => c.name === targetName);
    const targetIsPlayer = targetCreature?.type === 'player';
    let currentHp = 0;
    let maxHp = 0;
    if (targetIsPlayer) {
        currentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0;
        maxHp = getRuntimeValue(targetName, 'hitPoints', campaignName) ?? 0;
    } else {
        currentHp = targetCreature?.currentHp ?? targetCreature?.hit_points?.current ?? 0;
        maxHp = targetCreature?.maxHp ?? 0;
    }
    return currentHp > 0 && currentHp < maxHp;
}

function charmMonsterInfoPopup(description) {
    return { type: 'popup', payload: { type: 'automation_info', name: 'Charm Monster', description } };
}

async function executeCharmMonsterAction(action, playerStats, campaignName, mapName) {
    try {
        return await executeHandler(action, playerStats, campaignName, mapName);
    } catch (e) {
        console.error('[charmMonsterService] Failed to execute Charm Monster handler:', e);
        return charmMonsterInfoPopup('Failed to execute Charm Monster.');
    }
}

// Multi-target path: charmMonsterTargets array from CreatureSelectionModal
async function charmMonsterMultipleTargets(spell, targetNames, playerStats, campaignName, mapName, spellSaveDc, slotLevel) {
    const targetAdvantages = {};
    for (const targetName of targetNames) {
        targetAdvantages[targetName] = await getTargetHealthAdvantage(targetName, campaignName);
    }

    const action = {
        name: 'Charm Monster',
        automation: {
            type: 'charm_monster',
            saveDc: spellSaveDc,
            advantage: false,
        },
        metaCtx: {
            charmMonsterTargets: targetNames,
            charmMonsterAdvantages: targetAdvantages,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    return await executeCharmMonsterAction(action, playerStats, campaignName, mapName);
}

async function resolveCharmMonsterTarget(playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (cs?.creatures && cs.creatures.length > 0) {
        const attackerTarget = getTargetFromAttacker(cs, playerStats.name);
        if (attackerTarget) return attackerTarget.name;
    }
    console.error(`[charmMonsterService] No target selected for Charm Monster by ${playerStats.name}. Caster has no target in initiative view.`);
    return null;
}

export async function triggerCharmMonster(spell, metaCtx, playerStats, campaignName, mapName) {
    if ((spell.name || '').toLowerCase() !== 'charm monster') return null;

    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 4;

    const targetNames = metaCtx?.charmMonsterTargets;
    if (Array.isArray(targetNames) && targetNames.length > 0) {
        return await charmMonsterMultipleTargets(spell, targetNames, playerStats, campaignName, mapName, spellSaveDc, slotLevel);
    }

    const targetName = metaCtx?.targetName || await resolveCharmMonsterTarget(playerStats, campaignName);
    if (!targetName) {
        return charmMonsterInfoPopup('No target selected for Charm Monster.');
    }

    // Check if target is not at full health to determine if target gets advantage on save
    const advantage = await getTargetHealthAdvantage(targetName, campaignName);

    const action = {
        name: 'Charm Monster',
        automation: {
            type: 'charm_monster',
            saveDc: spellSaveDc,
            targetName: targetName,
            advantage: advantage,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    return await executeCharmMonsterAction(action, playerStats, campaignName, mapName);
}
