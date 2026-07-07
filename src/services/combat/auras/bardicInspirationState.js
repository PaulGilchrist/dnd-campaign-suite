import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export function hasBardicInspiration(name, campaignName) {
    const die = getRuntimeValue(name, 'bardicInspirationDie', campaignName);
    return !!die;
}

export function hasBardicInspirationDefense(name, campaignName) {
    if (!hasBardicInspiration(name, campaignName)) return false;
    const optionsRaw = getRuntimeValue(name, 'bardicInspirationCombatOptions', campaignName);
    let options = [];
    try { options = JSON.parse(optionsRaw) || []; } catch (_e) { /* ignore */ }
    return options.includes('defense_add_to_ac');
}

export function hasBardicInspirationOffense(name, campaignName) {
    if (!hasBardicInspiration(name, campaignName)) return false;
    const optionsRaw = getRuntimeValue(name, 'bardicInspirationCombatOptions', campaignName);
    let options = [];
    try { options = JSON.parse(optionsRaw) || []; } catch (_e) { /* ignore */ }
    return options.includes('offense_add_to_damage');
}

export function getBardicInspirationDieSize(name, campaignName) {
    const die = getRuntimeValue(name, 'bardicInspirationDie', campaignName);
    if (!die) return null;
    const num = Number(die);
    if (!isNaN(num) && num > 0) return num;
    const match = String(die).match(/d(\d+)/);
    return match ? Number(match[1]) : null;
}

export function getBardicInspirationGrantedBy(name, campaignName) {
    return getRuntimeValue(name, 'bardicInspirationGrantedBy', campaignName) || 'unknown';
}

export function clearBardicInspiration(name, campaignName) {
    setRuntimeValue(name, 'bardicInspirationDie', null, campaignName);
    setRuntimeValue(name, 'bardicInspirationGrantedBy', null, campaignName);
    setRuntimeValue(name, 'bardicInspirationCombatOptions', null, campaignName);
}
