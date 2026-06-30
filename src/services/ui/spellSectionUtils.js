import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const actionCastingTimes = ['1 action', '1 Action', 'action', 'Action'];
const bonusActionCastingTimes = ['1 bonus action', '1 Bonus Action', 'bonus action', 'Bonus Action'];
const reactionCastingTimes = ['1 reaction', '1 Reaction', 'reaction', 'Reaction'];

function isElderChampionActive(playerName, campaignName) {
    try {
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        return activeBuffs.some(b => b.name === 'Elder Champion');
    } catch { return false; }
}

/**
 * Returns a Set of spell names that should appear in the Actions section.
 * Only damage/healing spells with casting time of 1 action.
 * When Elder Champion is active, action spells are suppressed.
 */
export function getActionSpellNames(playerStats, campaignName) {
    if (elderChampionActive(playerStats, campaignName)) return new Set();
    const attackNames = new Set(playerStats.attacks?.filter(a => a.type === 'Action').map(a => a.name) || []);
    const names = new Set();
    for (const spell of playerStats.spellAbilities?.spells || []) {
        if (!actionCastingTimes.includes(spell.casting_time)) continue;
        if (spell.prepared !== 'Always' && spell.prepared !== 'Prepared') continue;
        if (attackNames.has(spell.name)) continue;
        if (!spell.damage && !spell.heal_at_slot_level) continue;
        names.add(spell.name);
    }
    return names;
}

/**
 * Returns a Set of spell names that should appear in the Bonus Actions section.
 * All prepared spells with casting time of 1 bonus action.
 * When Elder Champion is active, also includes action spells.
 */
export function getBonusActionSpellNames(playerStats, campaignName) {
    const elderActive = isElderChampionActive(playerStats.name, campaignName);
    const attackNames = new Set((playerStats.attacks || []).map(a => a.name));
    const names = new Set();
    for (const spell of playerStats.spellAbilities?.spells || []) {
        const isBonusAction = bonusActionCastingTimes.includes(spell.casting_time);
        const isActionSpellSwift = elderActive && actionCastingTimes.includes(spell.casting_time);
        if (!isBonusAction && !isActionSpellSwift) continue;
        if (spell.prepared !== 'Always' && spell.prepared !== 'Prepared') continue;
        if (attackNames.has(spell.name)) continue;
        names.add(spell.name);
    }
    return names;
}

/**
 * Returns a Set of spell names that should appear in the Reactions section.
 * All prepared spells with casting time of 1 reaction.
 */
export function getReactionSpellNames(playerStats) {
    const attackNames = new Set((playerStats.attacks || []).map(a => a.name));
    const names = new Set();
    for (const spell of playerStats.spellAbilities?.spells || []) {
        if (!reactionCastingTimes.includes(spell.casting_time)) continue;
        if (spell.prepared !== 'Always' && spell.prepared !== 'Prepared') continue;
        if (attackNames.has(spell.name)) continue;
        names.add(spell.name);
    }
    return names;
}

/**
 * Returns a Set of all spell names that appear in Actions, Bonus Actions, or Reactions.
 * CharSpells should exclude these names.
 */
export function getExcludedSpellNames(playerStats, campaignName) {
    const action = getActionSpellNames(playerStats, campaignName);
    const bonus = getBonusActionSpellNames(playerStats, campaignName);
    const reaction = getReactionSpellNames(playerStats);
    const allSpellNames = new Set([...action, ...bonus, ...reaction]);
    // Also exclude any spell that shares a name with an attack (attacks are shown in action/bonus/reaction sections)
    for (const attack of playerStats.attacks || []) {
        if (allSpellNames.has(attack.name)) continue;
        allSpellNames.add(attack.name);
    }
    return allSpellNames;
}

function elderChampionActive(playerStats, campaignName) {
    return isElderChampionActive(playerStats.name, campaignName);
}
