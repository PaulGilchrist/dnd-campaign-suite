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

export function hasBardicInspirationOffense(playerStats, campaignName) {
    const runtimeDie = getRuntimeValue(playerStats.name, 'bardicInspirationDie', campaignName);
    const runtimeOptionsRaw = getRuntimeValue(playerStats.name, 'bardicInspirationCombatOptions', campaignName);
    let runtimeOptions = [];
    try { runtimeOptions = JSON.parse(runtimeOptionsRaw) || []; } catch (_e) { /* ignore */ }
    const hasRuntimeOffense = !!runtimeDie && runtimeOptions.includes('offense_add_to_damage');

    const biUsesRaw = getRuntimeValue(playerStats.name, 'bardicInspirationUses', campaignName);
    const biUsesNum = (typeof biUsesRaw === 'object' && biUsesRaw !== null) ? biUsesRaw.current : (biUsesRaw != null ? Number(biUsesRaw) : (playerStats?._trackedResources?.bardicInspirationUses?.current ?? 0));
    const isBard = playerStats.class?.name === 'Bard';
    const hasBardUses = isBard && biUsesNum > 0;

    return hasRuntimeOffense || hasBardUses;
}

export function getBardicInspirationDieSize(name, campaignName) {
    const die = getRuntimeValue(name, 'bardicInspirationDie', campaignName);
    if (!die) return null;
    const num = Number(die);
    if (!isNaN(num) && num > 0) return num;
    const match = String(die).match(/d(\d+)/);
    return match ? Number(match[1]) : null;
}

export function getBardicInspirationDieSizeFromClass(playerStats) {
    const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
    const die = classLevel?.bardic_die || classLevel?.class_specific?.bardic_inspiration_die || 0;
    return die || null;
}

export function getBardicInspirationGrantedBy(name, campaignName) {
    return getRuntimeValue(name, 'bardicInspirationGrantedBy', campaignName) || 'unknown';
}

export function clearBardicInspiration(name, campaignName) {
    setRuntimeValue(name, 'bardicInspirationDie', null, campaignName);
    setRuntimeValue(name, 'bardicInspirationGrantedBy', null, campaignName);
    setRuntimeValue(name, 'bardicInspirationCombatOptions', null, campaignName);
}
