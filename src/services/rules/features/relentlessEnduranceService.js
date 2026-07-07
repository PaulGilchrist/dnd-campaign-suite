import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../shared/logPoster.js';

export function checkRelentlessEndurance(creature, playerComputed, campaignName) {
    const rawAllFeatures = playerComputed?.allFeatures;
    if (rawAllFeatures == null || !Array.isArray(rawAllFeatures)) {
        return { intercepted: false };
    }
    const allFeatures = rawAllFeatures;
    let hasRelentlessEndurance = false;

    for (const feature of allFeatures) {
        if (feature?.name === 'Relentless Endurance') {
            hasRelentlessEndurance = true;
            break;
        }
    }

    if (!hasRelentlessEndurance) {
        return { intercepted: false };
    }

    const alreadyUsed = getRuntimeValue(creature.name, 'relentlessEnduranceUsed', campaignName);
    if (alreadyUsed) {
        return { intercepted: false };
    }

    const storedMaxHp = getRuntimeValue(creature.name, 'hitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[applyDamage] Relentless Endurance: hitPoints not found for ${creature.name} in ${campaignName}`);
        throw new Error(`Relentless Endurance: hitPoints not found for ${creature.name}`);
    }
    const maxHp = storedMaxHp;
    const newHp = 1;

    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);

    setRuntimeValue(creature.name, 'relentlessEnduranceUsed', true, campaignName);

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
        type: 'hp_change',
        targetName: creature.name,
        delta: newHp,
        currentHp: newHp,
        maxHp: maxHp,
        isUnconscious: false,
        sourceName: 'Relentless Endurance',
    });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return {
        intercepted: true,
        finalDamage: 0,
        newHp,
    };
}
