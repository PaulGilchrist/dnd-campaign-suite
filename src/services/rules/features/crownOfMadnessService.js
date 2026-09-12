import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';

async function isTargetHumanoid(targetName, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures) return true;
    const creature = cs.creatures.find(c => c.name === targetName);
    if (!creature) return true;
    if (creature.type === 'player') return true;
    try {
        const monsterData = await getMonsterData(targetName, null);
        if (monsterData?.type) {
            return monsterData.type.toLowerCase() === 'humanoid';
        }
    } catch (error) { console.warn('[crownOfMadnessService] Monster type unavailable, defaulting to Humanoid:', error); }
    return true;
}

function madnessPopup(description) {
    return { type: 'popup', payload: { type: 'automation_info', name: 'Crown of Madness', description } };
}

// Explicit meta target, else the attacker's current target in initiative view.
async function resolveCrownTarget(playerStats, campaignName, metaCtx) {
    if (metaCtx?.targetName) return metaCtx.targetName;
    const cs = await getCombatContext(campaignName);
    if (cs?.creatures && cs.creatures.length > 0) {
        const attackerTarget = getTargetFromAttacker(cs, playerStats.name);
        if (attackerTarget) return attackerTarget.name;
    }
    console.error(`[crownOfMadnessService] No target selected for Crown of Madness by ${playerStats.name}. Caster has no target in initiative view.`);
    return null;
}

function resolveCrownSaveDc(metaCtx, playerStats) {
    return metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
}

export async function triggerCrownOfMadness(spell, metaCtx, playerStats, campaignName, mapName) {
    const isCrownOfMadness = (spell.name || '').toLowerCase() === 'crown of madness';
    if (!isCrownOfMadness) return null;

    const targetName = await resolveCrownTarget(playerStats, campaignName, metaCtx);
    if (!targetName) {
        return madnessPopup('No target selected for Crown of Madness.');
    }

    const humanoid = await isTargetHumanoid(targetName, campaignName);
    if (!humanoid) {
        return madnessPopup(`No effect. ${targetName} is not a Humanoid.`);
    }

    const cs = await getCombatContext(campaignName);
    const targetInCombat = cs?.creatures?.some(c => c.name === targetName && c.name !== playerStats.name) ?? false;

    const action = {
        name: 'Crown of Madness',
        automation: { type: 'crown_of_madness', saveDc: resolveCrownSaveDc(metaCtx, playerStats), targetName, advantage: targetInCombat },
        spell,
        spellSlotLevel: metaCtx?.slotLevel || spell.level || 2,
    };

    try {
        return await executeHandler(action, playerStats, campaignName, mapName);
    } catch (e) {
        console.error('[crownOfMadnessService] Failed to execute Crown of Madness handler:', e);
        return madnessPopup('Failed to execute Crown of Madness.');
    }
}
