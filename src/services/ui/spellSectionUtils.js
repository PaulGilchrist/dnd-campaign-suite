import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const actionCastingTimes = ['1 action', '1 Action', 'action', 'Action'];
const bonusActionCastingTimes = ['1 bonus action', '1 Bonus Action', 'bonus action', 'Bonus Action'];
const reactionCastingTimes = ['1 reaction', '1 Reaction', 'reaction', 'Reaction'];

const bonusActionFeatureTypes = ['free_spell', 'fey_reinforcements'];
const specialActionFeatureTypes = ['free_spell', 'fey_reinforcements', 'misty_wanderer'];

function isPrepared(spell) {
    return spell.prepared === 'Always' || spell.prepared === 'Prepared';
}

function collectActiveFeatureSpells(features, allowedTypes, playerName, campaignName, requireBonusCastingTime) {
    const names = new Set();
    for (const feature of features) {
        if (!allowedTypes.includes(feature.type)) continue;
        if (!feature.spell) continue;
        if (requireBonusCastingTime && !(feature.casting_time && bonusActionCastingTimes.includes(feature.casting_time))) continue;
        if (!isFeatureActive(feature.name, playerName, campaignName)) continue;
        const spellNames = Array.isArray(feature.spell) ? feature.spell : [feature.spell];
        for (const sn of spellNames) {
            names.add(sn);
        }
    }
    return names;
}

function isElderChampionActive(playerName, campaignName) {
    try {
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        return activeBuffs.some(b => b.name === 'Elder Champion');
    } catch { return false; }
}

function isFeatureActive(featureName, playerName, campaignName) {
    try {
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        return activeBuffs.some(b => b.name === featureName);
    } catch { return false; }
}

/**
 * Returns a Set of spell names that should appear in the Actions section.
 * Only damage/healing spells with casting time of 1 action.
 * When Elder Champion is active, action spells are suppressed.
 */
export function getActionSpellNames(playerStats, campaignName) {
    if (elderChampionActive(playerStats, campaignName)) return new Set();
    const names = new Set();
    for (const spell of playerStats.spellAbilities?.spells || []) {
        if (!actionCastingTimes.includes(spell.casting_time)) continue;
        if (!isPrepared(spell)) continue;
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
    const names = new Set();
    for (const spell of playerStats.spellAbilities?.spells || []) {
        const castsAsBonus = bonusActionCastingTimes.includes(spell.casting_time)
            || (elderActive && actionCastingTimes.includes(spell.casting_time));
        if (!castsAsBonus || !isPrepared(spell)) continue;
        names.add(spell.name);
    }
    const playerName = playerStats.name;
    for (const sn of collectActiveFeatureSpells(playerStats.automation?.bonusActions || [], bonusActionFeatureTypes, playerName, campaignName, true)) names.add(sn);
    for (const sn of collectActiveFeatureSpells(playerStats.automation?.specialActions || [], specialActionFeatureTypes, playerName, campaignName, false)) names.add(sn);
    return names;
}

/**
 * Returns a Set of spell names that should appear in the Reactions section.
 * All prepared spells with casting time of 1 reaction.
 */
export function getReactionSpellNames(playerStats) {
    const names = new Set();
    for (const spell of playerStats.spellAbilities?.spells || []) {
        if (!reactionCastingTimes.includes(spell.casting_time)) continue;
        if (!isPrepared(spell)) continue;
        names.add(spell.name);
    }
    return names;
}

/**
 * CLA-322: Spell Breaker casts its bonusActionSpells (e.g. Dispel Magic) as a
 * bonus action. Display-only override for sheet rows / spell popups — the entry's
 * casting_time is left untouched so section partitioning is unchanged.
 */
export function isSpellBreakerBonusActionSpell(playerStats, spellName) {
    if (!spellName) return false;
    const spellBreaker = playerStats?.automation?.passives?.find(p => p.type === 'spell_breaker');
    if (!spellBreaker) return false;
    return (spellBreaker.bonusActionSpells || []).includes(spellName);
}

/**
 * Returns a Set of all spell names that appear in Actions, Bonus Actions, or Reactions.
 * CharSpells should exclude these names.
 */
export function getExcludedSpellNames(playerStats, campaignName) {
    const action = getActionSpellNames(playerStats, campaignName);
    const bonus = getBonusActionSpellNames(playerStats, campaignName);
    const reaction = getReactionSpellNames(playerStats);
    return new Set([...action, ...bonus, ...reaction]);
}

function elderChampionActive(playerStats, campaignName) {
    return isElderChampionActive(playerStats.name, campaignName);
}

/**
 * Display-only: adds the Potent Spellcasting Wisdom bonus to a resolved
 * cantrip damage formula when applicable.
 */
export function applyPotentSpellcasting(resolved, playerStats, campaignName) {
    const potentFeature = playerStats.automation?.actions?.find(
        a => a.type === 'damage_bonus' && !a.upgrades && a.options?.some(o => o.toLowerCase().includes('spellcasting'))
    );
    if (!potentFeature) return resolved;
    const optKey = `_${(potentFeature.name || 'PotentSpellcasting').replace(/\s+/g, '_')}_option`;
    const chosen = getRuntimeValue(playerStats.name, optKey, campaignName);
    if (potentFeature.options.length > 1 && !chosen) return resolved;
    if (chosen && !chosen.toLowerCase().includes('spellcasting')) return resolved;
    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
    const wisMod = Math.max(0, wis?.bonus || 0);
    if (wisMod <= 0) return resolved;
    return `${resolved}+${wisMod}`;
}
