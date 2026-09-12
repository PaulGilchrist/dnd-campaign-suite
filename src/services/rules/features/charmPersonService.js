import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

/**
 * Check whether a creature (by name) is a Humanoid.
 * Players are always Humanoid. NPCs are checked against monster data.
 */
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
    } catch (error) {
        // If we can't load monster data, default to Humanoid
        console.warn('[charmPersonService] Monster data unavailable, defaulting to Humanoid:', error);
    }

    return true;
}

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

function charmInfoPopup(description) {
    return { type: 'popup', payload: { type: 'automation_info', name: 'Charm Person', description } };
}

function logNonHumanoidRejection(targetName, playerStats, campaignName) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Charm Person',
        description: `${playerStats.name} casts Charm Person on ${targetName} but it has no effect — ${targetName} is not a Humanoid.`,
    }).catch((e) => { console.error("[charmPersonService:log-error]", e); });
}

async function executeCharmAction(action, playerStats, campaignName, mapName) {
    try {
        return await executeHandler(action, playerStats, campaignName, mapName);
    } catch (e) {
        console.error('[charmPersonService] Failed to execute Charm Person handler:', e);
        return charmInfoPopup('Failed to execute Charm Person.');
    }
}

// Multi-target path: charmPersonTargets array from CreatureSelectionModal
async function charmMultipleTargets(spell, targetNames, playerStats, campaignName, mapName, spellSaveDc, slotLevel) {
    const humanoidTargets = [];
    const nonHumanoidTargets = [];
    for (const targetName of targetNames) {
        const humanoid = await isTargetHumanoid(targetName, campaignName);
        if (humanoid) {
            humanoidTargets.push(targetName);
        } else {
            nonHumanoidTargets.push(targetName);
        }
    }

    for (const targetName of nonHumanoidTargets) {
        logNonHumanoidRejection(targetName, playerStats, campaignName);
    }

    if (humanoidTargets.length === 0) {
        return charmInfoPopup('No valid Humanoid targets for Charm Person.');
    }

    // Build a single action with all target names and per-target advantage in metaCtx
    const targetAdvantages = {};
    for (const targetName of humanoidTargets) {
        targetAdvantages[targetName] = await getTargetHealthAdvantage(targetName, campaignName);
    }

    const action = {
        name: 'Charm Person',
        automation: {
            type: 'charm_person',
            saveDc: spellSaveDc,
            advantage: false,
        },
        metaCtx: {
            charmPersonTargets: humanoidTargets,
            charmPersonAdvantages: targetAdvantages,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    return await executeCharmAction(action, playerStats, campaignName, mapName);
}

async function resolveCharmTarget(playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (cs?.creatures && cs.creatures.length > 0) {
        const attackerTarget = getTargetFromAttacker(cs, playerStats.name);
        if (attackerTarget) return attackerTarget.name;
    }
    console.error(`[charmPersonService] No target selected for Charm Person by ${playerStats.name}. Caster has no target in initiative view.`);
    return null;
}

function resolveCharmSaveDc(metaCtx, playerStats) {
    const fallback = 8 + (playerStats.proficiency || 2);
    return metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || fallback;
}

export async function triggerCharmPerson(spell, metaCtx, playerStats, campaignName, mapName) {
    if ((spell.name || '').toLowerCase() !== 'charm person') return null;

    const spellSaveDc = resolveCharmSaveDc(metaCtx, playerStats);
    const slotLevel = metaCtx?.slotLevel || spell.level || 1;

    const targetNames = metaCtx?.charmPersonTargets;
    if (Array.isArray(targetNames) && targetNames.length > 0) {
        return await charmMultipleTargets(spell, targetNames, playerStats, campaignName, mapName, spellSaveDc, slotLevel);
    }

    const targetName = metaCtx?.targetName || await resolveCharmTarget(playerStats, campaignName);
    if (!targetName) {
        return charmInfoPopup('No target selected for Charm Person.');
    }

    // Check: Target is not a Humanoid
    const humanoid = await isTargetHumanoid(targetName, campaignName);
    if (!humanoid) {
        logNonHumanoidRejection(targetName, playerStats, campaignName);
        return charmInfoPopup(`No effect. ${targetName} is not a Humanoid.`);
    }

    const advantage = await getTargetHealthAdvantage(targetName, campaignName);

    const action = {
        name: 'Charm Person',
        automation: {
            type: 'charm_person',
            saveDc: spellSaveDc,
            targetName: targetName,
            advantage: advantage,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    return await executeCharmAction(action, playerStats, campaignName, mapName);
}
