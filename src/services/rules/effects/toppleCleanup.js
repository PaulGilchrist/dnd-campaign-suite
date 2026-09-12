import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';

function collectExpiredToppleTargets(targetEffects, currentRound) {
    const toppleTargets = new Set();
    for (const te of targetEffects) {
        if (te.effect !== 'topple') continue;
        if (!te.target) continue;
        if (te.appliedRound == null) continue;
        if (currentRound >= te.appliedRound + 1) {
            toppleTargets.add(te.target);
        }
    }
    return toppleTargets;
}

function clearProneCondition(targetName, campaignName) {
    const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'prone');
    if (filtered.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    }
}

/**
 * Clean up Topple weapon mastery Prone condition at start of target's next turn.
 */
export function cleanUpToppleConditions(activeName, campaignName) {
    const allTargetEffectsTopple = getRuntimeValue('campaign', 'targetEffects') || [];
    if (allTargetEffectsTopple.length === 0) return;
    const currentRound = getCurrentCombatRound(campaignName);
    const toppleTargets = collectExpiredToppleTargets(allTargetEffectsTopple, currentRound);
    if (toppleTargets.size === 0) return;

    for (const toppleTarget of toppleTargets) {
        clearProneCondition(toppleTarget, campaignName);
    }
    const cleanedTopple = allTargetEffectsTopple.filter(te => {
        if (te.effect !== 'topple') return true;
        if (!te.appliedRound) return true;
        if (toppleTargets.has(te.target) && currentRound >= te.appliedRound + 1) {
            return false;
        }
        return true;
    });
    if (cleanedTopple.length !== allTargetEffectsTopple.length) {
        setRuntimeValue('campaign', 'targetEffects', cleanedTopple, campaignName);
    }
}
