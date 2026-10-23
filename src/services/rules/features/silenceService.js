import { getDistanceFeet } from '../combat/rangeValidation.js';
import { isDistanceInRange } from '../combat/rangeCheck.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';

const SILENCE_EFFECT = 'silence';
const SILENCE_TARGET_EFFECT = 'silenced';
const SILENCE_KEY = 'silenceCaster';
const SILENCE_CENTER_KEY = 'silenceCenter';
const SILENCE_RADIUS_KEY = 'silenceRadius';

// DEAD-EXPORT CENSUS #1413 (dead-export batch, excised wholesale per fix#82/fix#97
// precedent — fresh census 2026-10-23: triggerSilence had ZERO production importers;
// the live cast popup is built inline by modalSpells.js handleSilence :279, which
// carries its own fix#107-parity-mirror parsers (modalSpells.js :247-:277). The
// dead triggerSilence forwarder (:73-:101), its private parsers rangeToFeet/
// aoeRadiusFromSize + FEET/MILE/RADIUS token set (the #1413(a)/(b) fixed bytes —
// law now owned solely by the modalSpells mirror), and SILENCE_NAME are DELETED.
// getSilencedTargets (:187-:193) is likewise ZERO-caller (read-sibling of the LIVE
// addSilencedTarget (SilenceModal.jsx) / removeSilencedTargets (silenceHandler.js);
// its filter predicate stays covered through hasSilenceZoneTargetEffect below,
// addSilencedTarget and removeSilencedTargets lanes).

export function isSilenceActive(playerName, campaignName) {
    return getRuntimeValue(playerName, SILENCE_KEY, campaignName) === true;
}

function getSilenceCenter(playerName, campaignName) {
    return getRuntimeValue(playerName, SILENCE_CENTER_KEY, campaignName) || null;
}

function getSilenceRadius(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, SILENCE_RADIUS_KEY, campaignName);
    return stored ? parseInt(stored, 10) : 20;
}

// #1413(c) fix: unguarded JSON.parse of the stored center. Producer census:
// silenceHandler.js resolveSilenceCenter :19-26 is the ONLY writer of
// silenceCenter — it ALWAYS emits JSON.stringify({gridX,gridY}) or null
// (cleared to null via setRuntimeValue at clearSilenceZone :30). A string
// that fails to parse is therefore store corruption, not a format we model:
// LOUD (console.error) per no-fallbacks law, then honest null so the
// documented downstream no-center arm runs ("the caster is modeled as
// standing at the zone center" -> targetName === casterName).
function parseSilenceCenter(centerStr) {
    if (typeof centerStr !== 'string') return centerStr ?? null;
    try {
        return JSON.parse(centerStr);
    } catch (e) {
        console.error('[silence] Corrupt stored silenceCenter (producer resolveSilenceCenter always JSON.stringify) — no-center arm:', e);
        return null;
    }
}

export function getSilenceSource(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    const buff = activeBuffs.find(b => b.effect === SILENCE_EFFECT);
    return buff?.sourceCharacter || null;
}

function hasSilenceZoneTargetEffect(casterName, targetName, campaignName) {
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    if (!Array.isArray(targetEffects)) return false;
    return targetEffects.some(
        te => te.effect === SILENCE_TARGET_EFFECT && te.source === casterName && te.target === targetName
    );
}

export function isCreatureInSilenceZone(targetName, casterName, campaignName) {
    if (!isSilenceActive(casterName, campaignName)) return false;

    // Manual-picker zone model: creatures chosen at cast time carry a 'silenced'
    // te from the caster — that IS zone membership until concentration breaks
    // (clear_silence_zone drains both te and the Silence activeBuffs).
    if (hasSilenceZoneTargetEffect(casterName, targetName, campaignName)) {
        return true;
    }

    const centerStr = getSilenceCenter(casterName, campaignName);
    if (!centerStr) {
        // No point on the grid: the caster is modeled as standing at the zone center.
        return targetName === casterName;
    }

    const center = parseSilenceCenter(centerStr);
    if (!center || center.gridX == null || center.gridY == null) {
        return targetName === casterName;
    }

    const radius = getSilenceRadius(casterName, campaignName);
    const radiusNum = radius ? parseInt(radius, 10) : 20;

    const combatSummary = getCombatContextSync(campaignName);
    if (!combatSummary) return false;

    const allCreatures = [
        ...(combatSummary.players || []),
        ...(combatSummary.creatures || []),
    ];

    const targetCreature = allCreatures.find(c => c.name === targetName);
    if (!targetCreature || targetCreature.gridX == null || targetCreature.gridY == null) return false;

    const dist = getDistanceFeet(center, { gridX: targetCreature.gridX, gridY: targetCreature.gridY });
    return isDistanceInRange(dist, radiusNum);
}

export function addSilencedTarget(casterName, targetName, campaignName) {
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const effects = [...targetEffects];
    const existingIdx = effects.findIndex(
        te => te.target === targetName && te.effect === SILENCE_TARGET_EFFECT && te.source === casterName
    );
    if (existingIdx >= 0) {
        effects[existingIdx] = {
            target: targetName,
            effect: SILENCE_TARGET_EFFECT,
            source: casterName,
            duration: 'concentration',
        };
    } else {
        effects.push({
            target: targetName,
            effect: SILENCE_TARGET_EFFECT,
            source: casterName,
            duration: 'concentration',
        });
    }
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);
}

export function removeSilencedTargets(casterName, campaignName) {
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    if (!Array.isArray(targetEffects)) return [];
    const cleaned = targetEffects.filter(
        te => !(te.effect === SILENCE_TARGET_EFFECT && te.source === casterName)
    );
    if (cleaned.length !== targetEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', cleaned, campaignName);
    }
    return targetEffects
        .filter(te => te.effect === SILENCE_TARGET_EFFECT && te.source === casterName)
        .map(te => te.target);
}

function getCombatContextSync(campaignName) {
    // #1413(d) fix (fix#77/#1074 ARM-B precedent family): this was
    // getRuntimeValue('campaign', 'combatSummary') — an arity-2 current-context
    // read (useRuntimeState.js:63 ignores campaignName entirely), so a second
    // campaign's 'campaign' store bled into this zone check. Rerouted to the
    // campaign-keyed combatData cache (cachedCombatSummaries Map,
    // encounters/combatData.js:7/:47 — the same fixed accessor modalSpells'
    // handleSilence is fed at execution/index.js:310). The underlying runtime
    // store's campaign-blindness itself stays deferred infra #1520.
    const summary = getCombatSummary(campaignName);
    if (summary == null) return null;
    if (typeof summary === 'string') {
        try {
            return JSON.parse(summary);
        } catch (e) {
            console.warn('[silence] Stored combat summary unavailable:', e);
            return null;
        }
    }
    return summary;
}
