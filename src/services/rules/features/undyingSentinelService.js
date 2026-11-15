import { getRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

function hasFeatureNamed(allFeatures, name) {
    for (const feature of allFeatures) {
        if (feature?.name === name) return true;
    }
    return false;
}

export function checkUndyingSentinel(creature, playerComputed, campaignName) {
    const rawAllFeatures = playerComputed?.allFeatures;
    if (rawAllFeatures == null || !Array.isArray(rawAllFeatures)) {
        return { intercepted: false };
    }

    if (!hasFeatureNamed(rawAllFeatures, 'Undying Sentinel')) {
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

    const rawConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName);
    const conditions = rawConditions || [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');

    // Merged full-store write (backlog 2026-11-15 PW): ONE setRuntimeBatch
    // POST replaces the old six separate setRuntimeValue calls
    // (currentHitPoints, undyingSentinelUsed, deathSaves, deathFailures,
    // isDead, activeConditions), each of which POSTed the whole char bucket
    // and broadcast its own SSE echo per intercept (network census: 7×
    // POST /ElderPaladin per Sentinel drop — six service legs plus the
    // damage flow's interim 0 write, which stays). Functional bytes are
    // unchanged, and setRuntimeBatch's valuesEqual self-skip mirrors the six
    // individual calls — CharHitPoints.jsx merged-revive precedent
    // (db0ad4cf8) / CLA-092 write-batching law.
    setRuntimeBatch(creature.name, {
        currentHitPoints: newHp,
        undyingSentinelUsed: true,
        deathSaves: [false, false, false],
        deathFailures: [false, false, false],
        isDead: 0,
        activeConditions: filtered,
    }, campaignName);

    if (creature.type === 'player') {
        creature.currentHp = newHp;
    }

    // Log-family parity (2026-11-14 resurrection log-family split): the 0-HP
    // auto-intercept row rides the hp_change heal family (delta/currentHp/
    // maxHp were already authored — only the type and the isHealing literal
    // were split from the family), so hp_change-keyed audits see revives.
    // sourceName names the lane, matching the 'sheet editor'/'GM HP override'
    // forged-source convention for writer-attributed rows.
    addEntry(campaignName, {
        type: 'hp_change',
        targetName: creature.name,
        delta: newHp,
        currentHp: newHp,
        maxHp: maxHp,
        isHealing: newHp > 0,
        isUnconscious: false,
        sourceName: 'Undying Sentinel',
    }).catch((e) => { console.error("[undyingSentinelService] Error:", e); });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return {
        intercepted: true,
        finalDamage: 0,
        newHp,
    };
}
