import { executeHandler } from '../../automation/index.js';
import { getDistanceFeet } from '../combat/rangeValidation.js';
import { isDistanceInRange } from '../combat/rangeCheck.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';

const SILENCE_NAME = 'Silence';
const SILENCE_EFFECT = 'silence';
const SILENCE_TARGET_EFFECT = 'silenced';
const SILENCE_KEY = 'silenceCaster';
const SILENCE_CENTER_KEY = 'silenceCenter';
const SILENCE_RADIUS_KEY = 'silenceRadius';

// #1413(b) fix: plural-'feet' silent-drop -> 120. DISK TOKEN CENSUS of the
// 'range' field this parser can receive (public/data/spells.json 331 rows /
// public/data/2024/spells.json 393 rows):
//   numeric feet tokens  : '5 feet'..'500 feet' plurals (x500+ across both
//                          disks; Silence itself '120 feet' x32/x36),
//                          'N-foot' hyphenated, '60 ft.' abbreviation (x1)
//   lawful non-feet      : 'Self' x68/x94, 'Touch' x68/x70, 'Sight' x2/x1,
//                          'Special' x1/x1, 'Unlimited' x1/x2,
//                          '1 mile' x2/x4, '500 miles' x1/x1
// The old /(\d+)-?foot/ matched NONE of the plural forms (space, not hyphen)
// — every real plural range silently coerced to 120. Extended set parses all
// numeric feet + mile forms honestly; non-numeric words and garbage
// LOUD-refuse (console.error, no-fallbacks law) to the documented Silence
// RAW default 120ft. This lane's live gate is name === 'Silence', whose
// range is '120 feet' on BOTH disks, so every unmatched token reaching here
// is out-of-contract input and must be heard, not swallowed.
const FEET_TOKEN_RE = /^(\d+)\s*-?\s*(?:feet|foot|ft\.?)(?![a-z])/i;
const MILE_TOKEN_RE = /^(\d+)\s*-?\s*(?:miles|mile|mi\.?)(?![a-z])/i;

function rangeToFeet(rangeStr) {
    if (!rangeStr) return 120; // documented default: Silence RAW range = 120 feet (both disks)
    const token = String(rangeStr).trim();
    const feet = token.match(FEET_TOKEN_RE);
    if (feet) return parseInt(feet[1], 10);
    const miles = token.match(MILE_TOKEN_RE);
    if (miles) return parseInt(miles[1], 10) * 5280;
    console.error(`[silence] Unrecognized range token "${rangeStr}" — not a foot/mile count; Silence RAW default 120ft applies.`);
    return 120;
}

// #1413(a) fix: numeric-.match crash on RAW 5e disk. SIZE CENSUS:
// public/data/spells.json — area_of_effect.size is NUMBER on ALL 89 aoe rows
// (grep '"size": [0-9]' = 89; distinct values [5,10,15,20,30,40,50,60,90,
// 100,150,200,360,2500,5280,40000]; Silence spells.json:8902 is size:20);
// public/data/2024/spells.json — size is STRING on all 118 aoe rows
// ('20-foot-radius', '10-foot Emanation', ...). The old
// aoeSize.match(/(\d+)-foot-radius/) threw TypeError on the RAW numeric
// shape, lane-rejecting genuine 5e disk rows BEFORE dispatch. Fixed arm
// order: typeof number first (honest numeric radius), feet-string second,
// loud-drop everything else to the documented 20-ft sphere default.
const RADIUS_TOKEN_RE = /^(\d+)\s*-?\s*(?:feet|foot|ft\.?)(?![a-z])/i;

function aoeRadiusFromSize(size) {
    if (size == null) return 20; // documented default: Silence is a 20-ft sphere
    if (typeof size === 'number') {
        if (Number.isFinite(size) && size > 0) return size;
        console.error(`[silence] Non-positive/non-finite numeric area_of_effect.size ${size} — 20ft sphere default.`);
        return 20;
    }
    if (typeof size === 'string') {
        const m = size.trim().match(RADIUS_TOKEN_RE);
        if (m) return parseInt(m[1], 10);
        console.error(`[silence] Unrecognized area_of_effect.size "${size}" — not a feet count; 20ft sphere default.`);
        return 20;
    }
    console.error(`[silence] Unexpected area_of_effect.size type ${typeof size} — 20ft sphere default.`);
    return 20;
}

export async function triggerSilence(spell, metaCtx, playerStats, campaignName, mapName) {
    const isSilence = (spell.name || '') === SILENCE_NAME;
    if (!isSilence) return null;

    const slotLevel = metaCtx?.slotLevel || spell.level || 2;
    const rangeFeet = rangeToFeet(spell.range || '120 feet');
    const aoeRadius = aoeRadiusFromSize(spell.area_of_effect?.size);

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
