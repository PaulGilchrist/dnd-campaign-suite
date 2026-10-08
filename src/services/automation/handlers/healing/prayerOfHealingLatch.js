import { getRuntimeValue, setRuntimeBatch } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getShortRestResources } from '../../../rules/effects/restRules-constants.js';
import { markFortifiedHealthUsed } from '../../../combat/automation/automationService.js';

// SP-091: persistent per-target once-per-Long-Rest latch — 2024 spells.json lv2:
// "A creature can't be affected by this spell again until that creature finishes
// a Long Rest." The old round-scoped stamp (prayerOfHealing_lastUsedRound_<T>)
// re-opened one round later AND survived the target's Long Rest (zero clear
// consumers) — wrong in both directions. CLA-288 byte-twin (relentlessEnduranceUsed,
// restRules-longRest.js:697): the latch lives on the AFFECTED creature's own
// runtime store under a static key, nulled ONLY by the Long Rest batch — it is
// registered in LONG_REST_RESOURCES (restRules-constants.js; CLA-130 rule: a
// latch missing from the reset lists never re-arms).

export const PRAYER_OF_HEALING_AFFECTED_KEY = 'prayerOfHealingAffected';

export function isAffectedByPrayerOfHealing(targetName, campaignName) {
    return Boolean(getRuntimeValue(targetName, PRAYER_OF_HEALING_AFFECTED_KEY, campaignName));
}

// Playbook §5 refusal convention: automation + <feature>_refused + reason token,
// zero heal, zero short-rest benefit, zero latch mutation.
export function refusePrayerOfHealingTarget(targetName, casterName, campaignName) {
    return addEntry(campaignName, {
        type: 'automation',
        automationType: 'prayer_of_healing_refused',
        characterName: targetName,
        description: `${targetName} refuses Prayer of Healing — already affected since their last Long Rest (no effect until that creature finishes a Long Rest).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[prayerOfHealing] Error logging refusal:', e); });
}

// SP-091 short-rest benefit: the canonical applyShortRest() needs the resting
// creature's full playerStats and is only wired to that creature's own Short
// Rest button, so the Prayer lane writes the SAME change-data keys the short
// rest batch writes — SHORT_REST_RESOURCES null re-arm (null = re-armed pools,
// readers use `stored ?? max`) — in ONE merged setRuntimeBatch per target
// together with the affected latch stamp. No HP change, no action spent, no
// concentration/invisibility cleanup (the creatures did not spend their own rest).
export function applyPrayerOfHealingShortRestBenefit(targetName, casterName, campaignName, latchStamp) {
    const updates = { [PRAYER_OF_HEALING_AFFECTED_KEY]: latchStamp };
    for (const key of getShortRestResources()) {
        updates[key] = null;
    }
    setRuntimeBatch(targetName, updates, campaignName);
    return addEntry(campaignName, {
        type: 'automation',
        automationType: 'short_rest_benefit_applied',
        characterName: targetName,
        description: `${targetName} gains the benefits of a Short Rest from ${casterName}'s Prayer of Healing — short-rest feature uses re-armed (shortRestHitDice pool untouched, no action expended).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[prayerOfHealing] Error logging short-rest benefit:', e); });
}

// SP-091: shared post-cast passives for both Prayer lanes (handler confirmFn
// + prayerOfHealingService twin) — range advisory (enforcement only) +
// Fortified Health consumption.
export async function finalizePrayerPostCast({ playerStats, results, bonusDetails, campaignName, enforcement }) {
    if (enforcement && results.length > 0) {
        await logPrayerOfHealingRangeAdvisory(playerStats.name, results.map(r => r.targetName), campaignName);
    }
    if (results.some(r => r.healAmount > 0) && bonusDetails?.some(d => d.name === 'Fortified Health')) {
        await markFortifiedHealthUsed(playerStats, campaignName);
    }
}

// SP-091 defect 3 (advisory residual): in-combat casting is instant and
// range-band/10-minute casting has zero consumers app-wide (playbook §70) —
// record the honest GM confirmation, no movement/timer subsystem.
export function logPrayerOfHealingRangeAdvisory(casterName, targetNames, campaignName) {
    return addEntry(campaignName, {
        type: 'automation',
        automationType: 'prayer_of_healing_range_advisory',
        characterName: casterName,
        description: `GM confirms ${targetNames.join(', ')} remained within 30 feet of ${casterName} for the spell's entire 10-minute casting (range/duration not enforced — advisory).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[prayerOfHealing] Error logging range advisory:', e); });
}
