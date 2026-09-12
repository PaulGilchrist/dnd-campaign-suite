import { executeHandler } from '../../automation/index.js';
import { getDistanceFeet } from '../combat/rangeValidation.js';
import { isDistanceInRange } from '../combat/rangeCheck.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const SILENCE_NAME = 'Silence';
const SILENCE_EFFECT = 'silence';
const SILENCE_TARGET_EFFECT = 'silenced';
const SILENCE_KEY = 'silenceCaster';
const SILENCE_CENTER_KEY = 'silenceCenter';
const SILENCE_RADIUS_KEY = 'silenceRadius';

function rangeToFeet(rangeStr) {
    if (!rangeStr) return 120;
    const match = String(rangeStr).match(/(\d+)-?foot/);
    return match ? parseInt(match[1], 10) : 120;
}

export async function triggerSilence(spell, metaCtx, playerStats, campaignName, mapName) {
    const isSilence = (spell.name || '') === SILENCE_NAME;
    if (!isSilence) return null;

    const slotLevel = metaCtx?.slotLevel || spell.level || 2;
    const rangeFeet = rangeToFeet(spell.range || '120 feet');
    const aoeSize = spell.area_of_effect?.size || '20-foot-radius';
    const aoeMatch = aoeSize.match(/(\d+)-foot-radius/);
    const aoeRadius = aoeMatch ? parseInt(aoeMatch[1], 10) : 20;

    const action = {
        name: SILENCE_NAME,
        automation: {
            type: 'silence',
            duration: 'Concentration, up to 10 minutes',
            range: rangeFeet,
            aoeRadius: aoeRadius,
            slotLevel: slotLevel,
        },
        spell,
        spellSlotLevel: slotLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error('[silence] Failed to execute handler:', e);
        return null;
    }
}

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

    const center = typeof centerStr === 'string' ? JSON.parse(centerStr) : centerStr;
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

export function getSilencedTargets(casterName, campaignName) {
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    if (!Array.isArray(targetEffects)) return [];
    return targetEffects
        .filter(te => te.effect === SILENCE_TARGET_EFFECT && te.source === casterName)
        .map(te => te.target);
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

function getCombatContextSync(_campaignName) {
    try {
        const stored = getRuntimeValue('campaign', 'combatSummary');
        if (stored) return typeof stored === 'string' ? JSON.parse(stored) : stored;
    } catch (_e) { console.warn('[silence] Stored combat summary unavailable:', _e); }
    return null;
}

