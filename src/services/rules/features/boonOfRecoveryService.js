import { getRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

export function checkBoonOfRecoveryLastStand(creature, playerComputed, campaignName) {
    const rawAllFeatures = playerComputed?.allFeatures;
    if (rawAllFeatures == null || !Array.isArray(rawAllFeatures)) {
        return { intercepted: false };
    }
    const allFeatures = rawAllFeatures;
    let hasBoonOfRecovery = false;

    for (const feature of allFeatures) {
        if (feature?.name === 'Last Stand') {
            hasBoonOfRecovery = true;
            break;
        }
    }

    if (!hasBoonOfRecovery) {
        return { intercepted: false };
    }

    const lastStandUsed = getRuntimeValue(creature.name, 'boonOfRecoveryLastStandUsed', campaignName);
    if (lastStandUsed) {
        return { intercepted: false };
    }

    const storedMaxHp = getRuntimeValue(creature.name, 'hitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[applyDamage] Last Stand: hitPoints not found for ${creature.name} in ${campaignName}`);
        throw new Error(`Last Stand: hitPoints not found for ${creature.name}`);
    }
    const maxHp = storedMaxHp;
    const healAmount = Math.floor(maxHp / 2);
    const newHp = Math.min(1 + healAmount, maxHp);

    const rawConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName);
    const conditions = rawConditions || [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');

    // Merged full-store write (backlog 2026-11-15 PW): ONE setRuntimeBatch
    // POST replaces the old six separate setRuntimeValue calls
    // (currentHitPoints, boonOfRecoveryLastStandUsed, deathSaves,
    // deathFailures, isDead, activeConditions) — the undyingSentinelService
    // twin's precedent, mirroring the CharHitPoints.jsx merged-revive lane
    // (db0ad4cf8) / CLA-092 write-batching law. Functional bytes unchanged;
    // valuesEqual self-skip mirrors the six individual calls.
    setRuntimeBatch(creature.name, {
        currentHitPoints: newHp,
        boonOfRecoveryLastStandUsed: true,
        deathSaves: [false, false, false],
        deathFailures: [false, false, false],
        isDead: 0,
        activeConditions: filtered,
    }, campaignName);

    if (creature.type === 'player') {
        creature.currentHp = newHp;
    }

    // Log-family parity (2026-11-14 resurrection log-family split): see the
    // undyingSentinelService twin — Last Stand's 0-HP rescue now lands as an
    // hp_change heal-family row instead of the type:'healing' outlier.
    addEntry(campaignName, {
        type: 'hp_change',
        targetName: creature.name,
        delta: newHp,
        currentHp: newHp,
        maxHp,
        isHealing: newHp > 0,
        isUnconscious: false,
        sourceName: 'Boon Of Recovery - Last Stand',
    }).catch((e) => { console.error("[boonOfRecovery] Error:", e); });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return {
        intercepted: true,
        finalDamage: 0,
        newHp,
    };
}
