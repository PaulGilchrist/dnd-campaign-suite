import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

/**
 * Remove all Calm Emotions effects (targetEffects + activeBuffs) caused by
 * the caster and restore suppressed conditions to their targets.
 *
 * Called from concentrationService cleanupConcentrationEffects and from
 * useInitiativeEffects on initiative roll.
 */
function restoreSuppressedConditions(effect, campaignName) {
    if (effect.mode !== 'immunity') return;
    if (!Array.isArray(effect.suppressedConditions) || effect.suppressedConditions.length === 0) return;
    if (!effect.target) return;

    const storedConditions = getRuntimeValue(effect.target, 'activeConditions') || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const lowerConditions = conditions.map(c => String(c).toLowerCase());
    for (const suppressedCond of effect.suppressedConditions) {
        const lowerSuppressed = String(suppressedCond).toLowerCase();
        if (!lowerConditions.includes(lowerSuppressed)) {
            setRuntimeValue(effect.target, 'activeConditions', [...conditions, suppressedCond], campaignName);
        }
    }
}

export function endCalmEmotions(casterName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const calmEffects = storedEffects.filter(
        te => te.effect === 'calm_emotions' && te.source === casterName
    );

    if (calmEffects.length === 0) return;

    // Restore suppressed conditions for immunity-mode effects
    for (const effect of calmEffects) {
        restoreSuppressedConditions(effect, campaignName);
    }

    // Remove all calm_emotions targetEffects from this caster
    const cleanedEffects = storedEffects.filter(
        te => !(te.effect === 'calm_emotions' && te.source === casterName)
    );
    if (cleanedEffects.length !== storedEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', cleanedEffects, campaignName, true);
    }

    // Remove "Calm Emotions" activeBuffs from all creatures
    const cs = getCombatSummary(campaignName);
    if (cs?.creatures) {
        for (const creature of cs.creatures) {
            const buffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName) || [];
            const filtered = buffs.filter(b => b.name !== 'Calm Emotions');
            if (filtered.length !== buffs.length) {
                setRuntimeValue(creature.name, 'activeBuffs', filtered, campaignName);
            }
        }
    }
}
