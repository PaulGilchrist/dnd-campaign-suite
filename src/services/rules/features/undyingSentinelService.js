import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';

export function checkUndyingSentinel(creature, playerComputed, campaignName) {
    const rawAllFeatures = playerComputed?.allFeatures;
    if (rawAllFeatures == null || !Array.isArray(rawAllFeatures)) {
        return { intercepted: false };
    }
    const allFeatures = rawAllFeatures;
    let hasUndyingSentinel = false;

    for (const feature of allFeatures) {
        if (feature?.name === 'Undying Sentinel') {
            hasUndyingSentinel = true;
            break;
        }
    }

    if (!hasUndyingSentinel) {
        return { intercepted: false };
    }

    const alreadyUsed = getRuntimeValue(creature.name, 'undyingSentinelUsed', campaignName);
    if (alreadyUsed) {
        return { intercepted: false };
    }

    const paladinClassLevel = playerComputed?.class?.class_levels?.find(cl => cl.level === playerComputed.level);
    const paladinLevel = paladinClassLevel?.level || playerComputed.level;
    const healAmount = paladinLevel * 3;
    const storedMaxHp = getRuntimeValue(creature.name, 'hitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[applyDamage] Undying Sentinel: hitPoints not found for ${creature.name} in ${campaignName}`);
        throw new Error(`Undying Sentinel: hitPoints not found for ${creature.name}`);
    }
    const maxHp = storedMaxHp;
    const newHp = Math.min(1 + healAmount, maxHp);

    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);

    setRuntimeValue(creature.name, 'undyingSentinelUsed', true, campaignName);

    setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
    setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);

    const rawConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName);
    const conditions = rawConditions || [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');
    setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);

    if (creature.type === 'player') {
        creature.currentHp = newHp;
    }

    postLogEntry(campaignName, {
        type: 'heal',
        targetName: creature.name,
        delta: newHp,
        currentHp: newHp,
        maxHp: maxHp,
        isHealing: true,
        isUnconscious: false,
        abilityName: 'Undying Sentinel',
    });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return {
        intercepted: true,
        finalDamage: 0,
        newHp,
    };
}
