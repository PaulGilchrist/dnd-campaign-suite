import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';

/**
 * Check whether a creature (by name) is a Humanoid.
 * Players are always Humanoid. NPCs are checked against monster data.
 */
async function isTargetHumanoid(targetName, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures) return true; // default to Humanoid if we can't check

    const creature = cs.creatures.find(c => c.name === targetName);
    if (!creature) return true;

    // Players are always Humanoid
    if (creature.type === 'player') return true;

    // Monsters: check their stat block for type
    try {
        const monsterData = await getMonsterData(targetName, null);
        if (monsterData?.type) {
            return monsterData.type.toLowerCase() === 'humanoid';
        }
    } catch {
        // If we can't load monster data, default to Humanoid
    }

    return true;
}

/**
 * Check whether the caster has cast Friends on this target.
 */
function hasRecentFriendsCast(casterName, targetName, campaignName) {
    const key = `_friends_24h_${casterName}_${targetName}`;
    const lastCast = getRuntimeValue(casterName, key, campaignName);
    return !!lastCast;
}

/**
 * Record that Friends was cast on a target.
 */
function recordFriendsCast(casterName, targetName, campaignName) {
    const key = `_friends_24h_${casterName}_${targetName}`;
    setRuntimeValue(casterName, key, true, campaignName);
}

export async function triggerFriends(spell, metaCtx, playerStats, campaignName, mapName) {
    const isFriends = (spell.name || '').toLowerCase() === 'friends';
    if (!isFriends) return null;

    let targetName = metaCtx?.targetName;
    if (!targetName) {
        // Try to get target from combat context as a fallback
        const cs = await getCombatContext(campaignName);
        if (cs?.creatures && cs.creatures.length > 0) {
            // Find the first creature that isn't the caster
            const nonCaster = cs.creatures.find(c => c.name !== playerStats.name);
            if (nonCaster) targetName = nonCaster.name;
        }
    }
    if (!targetName) {
        return { type: 'popup', payload: { type: 'automation_info', name: 'Friends', description: 'No target selected for Friends.' } };
    }

    // --- Auto-save condition checks ---

    // Check 1: Target is not a Humanoid
    const humanoid = await isTargetHumanoid(targetName, campaignName);
    if (!humanoid) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Friends',
            description: `${playerStats.name} casts Friends on ${targetName} but it has no effect — ${targetName} is not a Humanoid.`,
        }).catch(() => {});
        return { type: 'popup', payload: { type: 'automation_info', name: 'Friends', description: `No effect. ${targetName} is not a Humanoid.` } };
    }

    // Check 2: Cast within 24 hours
    if (hasRecentFriendsCast(playerStats.name, targetName, campaignName)) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Friends',
            description: `${playerStats.name} casts Friends on ${targetName} but it has no effect — already cast within the past 24 hours.`,
        }).catch(() => {});
        return { type: 'popup', payload: { type: 'automation_info', name: 'Friends', description: `No effect. You have already cast Friends on ${targetName} within the past 24 hours.` } };
    }

    // Record the cast for cooldown tracking
    recordFriendsCast(playerStats.name, targetName, campaignName);

    // Build the spell save DC
    const spellSaveDc = metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (playerStats.proficiency || 2);
    const slotLevel = metaCtx?.slotLevel || spell.level || 0;

    const action = {
        name: 'Friends',
        automation: {
            type: 'friends',
            saveDc: spellSaveDc,
            targetName: targetName,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[friendsService] Failed to execute Friends handler:', e);
        return { type: 'popup', payload: { type: 'automation_info', name: 'Friends', description: `Failed to execute Friends.` } };
    }
}

/**
 * End Friends early for the caster if they take a hostile action
 * (make an attack roll, deal damage, or force a saving throw).
 * Called from the relevant hooks/services when such actions occur.
 */
export function endFriendsOnHostileAction(casterName, campaignName) {
    const key = `_activeFriends_${casterName}`;
    const activeTarget = getRuntimeValue(campaignName, key, campaignName);
    if (!activeTarget) return;

    const conditions = (() => {
        const x = getRuntimeValue(activeTarget, 'activeConditions', campaignName);
        if (x == null) { console.error('[friendsService] Missing array:', x); throw new Error('Expected array, got ' + x); }
        return x;
    })();
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    if (filtered.length !== conditions.length) {
        setRuntimeValue(activeTarget, 'activeConditions', filtered, campaignName);
    }
    setRuntimeValue(campaignName, key, null, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Friends',
        description: `${activeTarget} knows it was Charmed by ${casterName} as the Friends spell ends early.`,
    }).catch(() => {});
}
