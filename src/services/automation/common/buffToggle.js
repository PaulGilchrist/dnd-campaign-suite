import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

/**
 * Toggle an active buff on/off for a character.
 *
 * For round-limited durations like "until_start_of_next_turn", the caller
 * MUST also register an expiration via addExpiration({ attackerName, targetName,
 * effects: [{ type: 'remove_active_buff', buffName }], campaignName, rounds }) so the buff
 * is auto-cleared when expireStaleEffects runs on round advance.
 *
 * See buffAllyHandler.js for a complete example of this pattern.
 */
/**
 * Compute the activeBuffs array after toggling actionName, WITHOUT writing it.
 * Pure — callers that need a single merged store write (SP-094: activateProtection
 * writes activeBuffs + warded types atomically) call this and then a single
 * setRuntimeObject; toggleBuff wraps it with its own write for the common case.
 */
export function computeToggledBuffs(activeBuffs, actionName, auto, playerName) {
    const buffs = Array.isArray(activeBuffs) ? activeBuffs : [];
    const wasActive = buffs.some(b => b.name === actionName);
    const newBuffs = wasActive
        ? buffs.filter(b => b.name !== actionName)
        : [...buffs, { name: actionName, effect: auto.effect, duration: auto.duration, enemiesDisadvantageSaves: auto.enemies_disadvantage_saves || [], distance: auto.distance || '', extendedDistance: auto.extendedDistance || '', sourceCharacter: playerName, blocksSpellcasting: auto.blocksSpellcasting || false, flySpeed: auto.flySpeed || null, hover: auto.hover || false, seeInvisibleRange: auto.seeInvisibleRange || null, narrowSpace: !!auto.narrowSpace, castingTime: auto.casting_time || '', resistanceTypes: auto.resistanceTypes || [], acBonus: auto.acBonus || 0, saveBonus: auto.saveBonus || 0 }];
    return { isActive: !wasActive, wasActive, buffs: newBuffs };
}

export function toggleBuff(playerName, actionName, auto, campaignName, targetName) {
     const resolvedTarget = targetName || playerName;
     const stored = getRuntimeValue(resolvedTarget, 'activeBuffs', campaignName);
     const { isActive, wasActive, buffs: newBuffs } = computeToggledBuffs(stored, actionName, auto, playerName);
     setRuntimeValue(resolvedTarget, 'activeBuffs', newBuffs, campaignName);

     return { isActive, buffs: newBuffs, wasActive, targetName: resolvedTarget };
 }

export function getActiveBuffs(playerName, campaignName) {
    const buffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    return Array.isArray(buffs) ? buffs : [];
}

export function isBuffActive(playerName, buffName, campaignName) {
    return getActiveBuffs(playerName, campaignName).some(b => b.name === buffName);
}

export function hasBuffEffect(playerName, effect, campaignName) {
    return getActiveBuffs(playerName, campaignName).some(b => b.effect === effect);
}
