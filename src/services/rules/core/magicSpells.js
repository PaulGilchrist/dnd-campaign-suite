import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

/**
 * Rename Magic Initiate "Level 1 Spell" features with instance indices
 * to avoid runtime key collisions for repeatable instances.
 */
export function renameMagicInitiateFeatures(playerStats, playerSummary) {
    const campaignName = playerSummary?.campaignName;
    const instances = getRuntimeValue(playerStats.name, '_magicInitiateInstances', campaignName) || playerStats.magicInitiateInstances;
    if (!instances || !Array.isArray(instances) || instances.length === 0) return;

    const automation = playerStats.automation;
    if (!automation) return;

    // Collect all "Level 1 Spell" features across all automation arrays
    const level1Features = [];
    ['actions', 'bonusActions', 'reactions', 'passives', 'specialActions'].forEach(arrayName => {
        const arr = automation[arrayName];
        if (!Array.isArray(arr)) return;
        arr.forEach(feature => {
            if (!feature || !feature.name || feature.name !== 'Level 1 Spell') return;
            const auto = feature.automation;
            if (!auto || auto.type !== 'free_spell') return;
            level1Features.push({ feature, auto, arrayName });
        });
    });

    // Rename them in order to match instances
    level1Features.forEach((item, i) => {
        if (i >= instances.length) return;
        const newName = `Level 1 Spell [Instance ${i + 1}]`;
        item.feature.name = newName;
        if (item.auto.name) item.auto.name = newName;
    });
}
