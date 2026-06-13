import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

/**
 * Toggle an active buff on/off for a character.
 *
 * For round-limited durations like "until_start_of_next_turn", the caller
 * MUST also register an expiration via addExpiration(attacker, target,
 * [{ type: 'remove_active_buff', buffName }], campaignName) so the buff
 * is auto-cleared when expireStaleEffects runs on round advance.
 *
 * See buffAllyHandler.js for a complete example of this pattern.
 */
export function toggleBuff(playerName, actionName, auto, campaignName, targetName) {
     const resolvedTarget = targetName || playerName;
     const stored = getRuntimeValue(resolvedTarget, 'activeBuffs', campaignName);
     const activeBuffs = Array.isArray(stored) ? stored : [];
     const wasActive = activeBuffs.some(b => b.name === actionName);

       const newBuffs = wasActive
            ? activeBuffs.filter(b => b.name !== actionName)
             : [...activeBuffs, { name: actionName, effect: auto.effect, duration: auto.duration, enemiesDisadvantageSaves: auto.enemies_disadvantage_saves || [], distance: auto.distance || '', extendedDistance: auto.extendedDistance || '', sourceCharacter: playerName, blocksSpellcasting: auto.blocksSpellcasting || false, flySpeed: auto.flySpeed || null, hover: auto.hover || false, seeInvisibleRange: auto.seeInvisibleRange || null, narrowSpace: !!auto.narrowSpace }];

     setRuntimeValue(resolvedTarget, 'activeBuffs', newBuffs, campaignName);

     return { isActive: !wasActive, buffs: newBuffs, wasActive, targetName: resolvedTarget };
 }

export function getActiveBuffs(playerName, campaignName) {
    const buffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    return Array.isArray(buffs) ? buffs : [];
}

export function isBuffActive(playerName, buffName, campaignName) {
    return getActiveBuffs(playerName, campaignName).some(b => b.name === buffName);
}
