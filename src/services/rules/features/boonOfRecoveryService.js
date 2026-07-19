import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

export function checkBoonOfRecoveryLastStand(creature, playerComputed, campaignName) {
    const rawAllFeatures = playerComputed?.allFeatures;
    if (rawAllFeatures == null || !Array.isArray(rawAllFeatures)) {
        return { intercepted: false };
    }
    const allFeatures = rawAllFeatures;
    let hasBoonOfRecovery = false;

    for (const feature of allFeatures) {
        if (feature?.name === 'Boon Of Recovery') {
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

    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
    setRuntimeValue(creature.name, 'boonOfRecoveryLastStandUsed', true, campaignName);

    setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
    setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);
    setRuntimeValue(creature.name, 'isDead', 0, campaignName);

    const rawConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName);
    const conditions = rawConditions || [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');
    setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);

    if (creature.type === 'player') {
        creature.currentHp = newHp;
    }

    addEntry(campaignName, {
        type: 'healing',
        targetName: creature.name,
        delta: newHp,
        amount: newHp,
        currentHp: newHp,
        maxHp,
        isHealing: true,
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
