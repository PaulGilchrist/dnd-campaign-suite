import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';
import { addEntry } from '../../ui/logService.js';
import { addConcentration } from '../../combat/concentration/concentrationService.js';
import storage from '../../ui/storage.js';
import { getCombatSummary } from '../../encounters/combatData.js';

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
    } catch (error) {
        // If we can't load monster data, default to Humanoid
        console.warn('[friendsService] Monster data unavailable, defaulting to Humanoid:', error);
    }

    return true;
}

/**
 * Check whether the caster has cast Friends on this target within the past 24 hours.
 */
function hasRecentFriendsCast(casterName, targetName, campaignName) {
    const targets = getRuntimeValue(casterName, '_friendsCastTargets', campaignName) || [];
    return targets.includes(targetName);
}

/**
 * Record that Friends was cast on a target.
 */
function recordFriendsCast(casterName, targetName, campaignName) {
    const targets = getRuntimeValue(casterName, '_friendsCastTargets', campaignName) || [];
    if (!targets.includes(targetName)) {
        setRuntimeValue(casterName, '_friendsCastTargets', [...targets, targetName], campaignName);
    }
}

/**
 * Resolve the Friends target: explicit selection, else the caster's target in
 * initiative view. Logs (and returns null) when nothing is selected.
 */
async function resolveFriendsTarget(metaCtx, playerStats, campaignName) {
    let targetName = metaCtx?.targetName;
    if (targetName) return targetName;

    const cs = await getCombatContext(campaignName);
    if (cs?.creatures && cs.creatures.length > 0) {
        const attackerTarget = getTargetFromAttacker(cs, playerStats.name);
        if (attackerTarget) targetName = attackerTarget.name;
    }
    if (!targetName) {
        console.error(`[friendsService] No target selected for Friends by ${playerStats.name}. Caster has no target in initiative view.`);
    }
    return targetName || null;
}

// Shared "no effect" campaign log + popup for the pre-cast condition checks.
function logFriendsNoEffect(campaignName, casterName, targetName, reason, popupDescription) {
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Friends',
        description: `${casterName} casts Friends on ${targetName} but it has no effect — ${reason}.`,
    }).catch((e) => { console.error("[friendsService:log-error]", e); });
    return { type: 'popup', payload: { type: 'automation_info', name: 'Friends', description: popupDescription } };
}

// Check 3 support: target's current/max HP (players read the runtime store,
// monsters the combat-summary creature entry).
function resolveTargetHealth(targetCreature, targetName, playerStats, campaignName) {
    if (targetCreature?.type === 'player') {
        const currentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? playerStats.computedStats?.currentHp ?? 0;
        const maxHp = getRuntimeValue(targetName, 'hitPoints', campaignName) ?? playerStats.computedStats?.maxHp ?? 0;
        return { currentHp, maxHp };
    }
    const currentHp = targetCreature?.currentHp ?? targetCreature?.hit_points?.current ?? 0;
    const maxHp = targetCreature?.maxHp ?? 0;
    return { currentHp, maxHp };
}

// Set concentration on the caster so the badge shows in the initiative tracker
function setFriendsConcentrationBadge(csForConc, playerStats, campaignName) {
    const concentrationDc = 8 + (playerStats.proficiency || 2) + (playerStats.abilities?.CON?.bonus ?? 0);
    addConcentration(csForConc, playerStats.name, 'Friends', concentrationDc);
    storage.set('combatSummary', csForConc, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

export async function triggerFriends(spell, metaCtx, playerStats, campaignName, mapName) {
    const isFriends = (spell.name || '').toLowerCase() === 'friends';
    if (!isFriends) return null;

    const targetName = await resolveFriendsTarget(metaCtx, playerStats, campaignName);
    if (!targetName) {
        return { type: 'popup', payload: { type: 'automation_info', name: 'Friends', description: 'No target selected for Friends.' } };
    }

    // --- Auto-save condition checks ---

    // Check 1: Target is not a Humanoid
    const humanoid = await isTargetHumanoid(targetName, campaignName);
    if (!humanoid) {
        return logFriendsNoEffect(campaignName, playerStats.name, targetName,
            `${targetName} is not a Humanoid.`,
            `No effect. ${targetName} is not a Humanoid.`);
    }

    // Check 2: Cast within 24 hours
    if (hasRecentFriendsCast(playerStats.name, targetName, campaignName)) {
        return logFriendsNoEffect(campaignName, playerStats.name, targetName,
            'already cast within the past 24 hours.',
            `No effect. You have already cast Friends on ${targetName} within the past 24 hours.`);
    }

    // Check 3: Target is not at full health (immunized — cannot be charmed)
    const cs = await getCombatContext(campaignName);
    const targetCreature = cs?.creatures?.find(c => c.name === targetName);
    const { currentHp, maxHp } = resolveTargetHealth(targetCreature, targetName, playerStats, campaignName);
    const isAtFullHealth = currentHp >= maxHp && maxHp > 0;
    if (!isAtFullHealth) {
        return logFriendsNoEffect(campaignName, playerStats.name, targetName,
            `${targetName} is not at full health and is immunized to the effect.`,
            `No effect. ${targetName} is not at full health and is immunized to the effect.`);
    }

    // Record the cast for cooldown tracking
    recordFriendsCast(playerStats.name, targetName, campaignName);

    const csForConc = getCombatSummary(campaignName);
    if (csForConc) {
        setFriendsConcentrationBadge(csForConc, playerStats, campaignName);
    }

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
    const activeTarget = getRuntimeValue('campaign', key, campaignName);
    if (!activeTarget) return;

    const conditions = (() => {
        const x = getRuntimeValue(activeTarget, 'activeConditions', campaignName);
        if (x == null) return [];
        return x;
    })();
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    if (filtered.length !== conditions.length) {
        setRuntimeValue(activeTarget, 'activeConditions', filtered, campaignName);
    }
    setRuntimeValue('campaign', key, null, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Friends',
        description: `${activeTarget} knows it was Charmed by ${casterName} as the Friends spell ends early.`,
    }).catch((e) => { console.error("[friendsService:log-error]", e); });
}
