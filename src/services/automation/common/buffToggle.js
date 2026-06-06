import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export function toggleBuff(playerName, actionName, auto, campaignName) {
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const wasActive = activeBuffs.some(b => b.name === actionName);

    const newBuffs = wasActive
         ? activeBuffs.filter(b => b.name !== actionName)
         : [...activeBuffs, { name: actionName, effect: auto.effect, duration: auto.duration }];

    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    return { isActive: !wasActive, buffs: newBuffs, wasActive };
}

export function getActiveBuffs(playerName, campaignName) {
    const buffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    return Array.isArray(buffs) ? buffs : [];
}

export function isBuffActive(playerName, buffName, campaignName) {
    return getActiveBuffs(playerName, campaignName).some(b => b.name === buffName);
}
