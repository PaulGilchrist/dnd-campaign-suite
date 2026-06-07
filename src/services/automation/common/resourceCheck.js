import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { getClassFeatures } from '../../character/classFeatures.js';

export function getResourceAmount(playerStats, resourceName) {
    if (resourceName === 'focusPoints') {
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        return classLevel?.focus_points || getClassFeatures(playerStats)?.maxFocusPoints || 0;
     }
    const key = `${resourceName.toLowerCase().replace(/\s+/g, '')}Uses`;
    const stored = getRuntimeValue(playerStats.name, key);
    return stored != null ? Number(stored) : (playerStats?._trackedResources?.[key]?.current ?? 0);
}

export function spendResource(playerName, resourceNameOrKey, amount, campaignName) {
    const stored = getRuntimeValue(playerName, resourceNameOrKey, campaignName);
    const current = stored != null ? Number(stored) : 0;
    const newAmount = current - amount;
    setRuntimeValue(playerName, resourceNameOrKey, newAmount, campaignName);
    return newAmount;
}

export function checkResourceRemaining(resourceKey, maxUses, playerName, campaignName) {
    const current = getRuntimeValue(playerName, resourceKey, campaignName);
    const used = current != null ? Number(current) : 0;
    return { remaining: maxUses - used, canUse: used < maxUses };
}
