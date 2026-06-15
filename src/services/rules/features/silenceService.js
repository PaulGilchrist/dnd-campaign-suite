import { executeHandler } from '../../automation/index.js';
import { getDistanceFeet } from '../combat/rangeValidation.js';
import { getRuntimeValue } from '../../../hooks/useRuntimeState.js';

const SILENCE_NAME = 'Silence';
const SILENCE_EFFECT = 'silence';
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

export function getSilenceCenter(playerName, campaignName) {
    return getRuntimeValue(playerName, SILENCE_CENTER_KEY, campaignName) || null;
}

export function getSilenceRadius(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, SILENCE_RADIUS_KEY, campaignName);
    return stored ? parseInt(stored, 10) : 20;
}

export function getSilenceSource(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    const buff = activeBuffs.find(b => b.effect === SILENCE_EFFECT);
    return buff?.sourceCharacter || null;
}

export function getCreaturesInSilenceZone(casterName, campaignName) {
    const center = getSilenceCenter(casterName, campaignName);
    if (!center) return [];

    const radius = getSilenceRadius(casterName, campaignName);
    const combatSummary = getCombatContextSync(campaignName);
    if (!combatSummary) return [];

    const casterPos = combatSummary.players?.find(p => p.name === casterName);
    if (!casterPos) return [];

    const centerGrid = { gridX: casterPos.gridX, gridY: casterPos.gridY };
    const allCreatures = [
        ...(combatSummary.players || []),
        ...(combatSummary.creatures || []),
    ];

    return allCreatures.filter(c => {
        if (c.name === casterName) return false;
        const gridX = c.gridX;
        const gridY = c.gridY;
        if (gridX == null || gridY == null) return false;
        const dist = getDistanceFeet(centerGrid, { gridX, gridY });
        return dist <= radius;
    }).map(c => c.name);
}

export function isCreatureInSilenceZone(targetName, casterName, campaignName) {
    if (!isSilenceActive(casterName, campaignName)) return false;

    const centerStr = getSilenceCenter(casterName, campaignName);
    if (!centerStr) return false;

    const center = typeof centerStr === 'string' ? JSON.parse(centerStr) : centerStr;
    if (!center || center.gridX == null || center.gridY == null) return false;

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
    return dist <= radiusNum;
}

function getCombatContextSync(campaignName) {
    try {
        const stored = getRuntimeValue(campaignName, 'combatSummary');
        if (stored) return typeof stored === 'string' ? JSON.parse(stored) : stored;
    } catch (e) { /* ignore */ }
    return null;
}

export function shouldHaveDeafenedFromSilence(targetName, campaignName) {
    if (!isSilenceActive(targetName, campaignName)) return false;
    return isCreatureInSilenceZone(targetName, targetName, campaignName);
}

export function getSilenceDeafenedSources(targetName, campaignName) {
    const sources = [];
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    for (const buff of activeBuffs) {
        if (buff.effect === SILENCE_EFFECT && buff.sourceCharacter) {
            if (isCreatureInSilenceZone(targetName, buff.sourceCharacter, campaignName)) {
                sources.push(buff.sourceCharacter);
            }
        }
    }
    return sources;
}
