import { isWithinRange, isDistanceInRange } from '../../rules/combat/rangeCheck.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { loadMapData } from '../../maps/mapsService.js';
import { getCombatContext, getCombatSummary } from '../../encounters/combatData.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// Phase 3.2 audit (arena-starter §4): NOT an allegiance assumption — the
// pool filter only gathers aura BEARERS; per-target hostility is the bearer's
// explicit `coronaOfLightEnemies` designation (isInCoronaEnemiesList), so a
// betrayal edit needs no type-gate here.
function isInCoronaEnemiesList(sourceName, targetName) {
    const storedEnemies = getRuntimeValue(sourceName, 'coronaOfLightEnemies') || [];
    if (!Array.isArray(storedEnemies)) return true;
    if (!storedEnemies.length) return true;
    if (typeof storedEnemies[0] !== 'string') return true;
    return storedEnemies.includes(targetName);
}

function getCoronaBuffForTarget(playerName, targetName) {
    const buffs = getRuntimeValue(playerName, 'activeBuffs') || [];
    const coronaBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'sunlight_aura') : null;
    if (!coronaBuff) return null;
    if (!isInCoronaEnemiesList(playerName, targetName)) return null;
    return coronaBuff;
}

// CLA-063: Fire/Radiant damage-type gate, shared by the async and sync lanes.
function coronaDamageTypeMatches(coronaBuff, damageType) {
    const applicableTypes = coronaBuff.enemiesDisadvantageSaves || [];
    if (applicableTypes.length === 0) return false;
    if (damageType) {
        const normalizedType = damageType.charAt(0).toUpperCase() + damageType.slice(1).toLowerCase();
        if (!applicableTypes.includes(normalizedType)) return false;
    }
    return true;
}

function resolveCoronaPlayers(mapData) {
    if (mapData?.players?.length) return mapData.players;
    return [];
}

// Authored aura radius ("in the Bright Light", 60 ft); missing/garbage
// distance falls back to the authored default.
function coronaRangeFt(coronaBuff) {
    return parseInt(coronaBuff.distance, 10) || 60;
}

function findMapToken(mapData, name) {
    if (!mapData) return null;
    return [...(mapData.players || []), ...(mapData.placedItems || [])].find(t => t.name === name) || null;
}

function hasTokenPosition(token) {
    return !!token && Number.isFinite(token.gridX) && Number.isFinite(token.gridY);
}

// 60 ft range-gate bug (2026-11-04): the aura is authored 60 ft, so a victim
// measurable beyond it on the active map must NOT pay save Disadvantage.
// Measured/lenient fork mirrors the wolf/lion aura lanes
// (contextBuilder-map.js accumulateAuraCounts consult-and-fork): when the
// active map tracks positions for BOTH bearer and victim the distance goes
// through the universal checker (isWithinRange); pairs that cannot be
// measured (no active map, gridless tokens, creature with no placed token)
// stay consulted-and-passes lenient — phantom/tokenless targets CANNOT be
// gated (house law §44). This is intentionally more lenient than
// isWithinRange's "unplaced → false" rule: that law gates a real ranged
// attack; an aura must not fabricate a refusal against an unpositioned
// creature.
async function coronaBearerReaches(bearerName, targetName, rangeFt, mapData) {
    let data = mapData;
    if (!data) {
        const activeMapName = getRuntimeValue('__map__', 'activeMapName');
        if (!activeMapName) return true;
        try {
            data = await loadMapData(getRuntimeValue('__campaign__', 'campaignName'), activeMapName);
        } catch {
            return true;
        }
        if (!data) return true;
    }
    if (!hasTokenPosition(findMapToken(data, bearerName)) || !hasTokenPosition(findMapToken(data, targetName))) return true;
    return await isWithinRange(bearerName, targetName, rangeFt);
}

export async function getCoronaSaveDisadvantage({ targetName, mapData, damageType, campaignName }) {
    let players = resolveCoronaPlayers(mapData);
    if (!players.length) {
        const combatSummary = getCombatSummary(campaignName) || await getCombatContext(campaignName);
        players = (combatSummary?.creatures || []).filter(c => c.type === 'player');
    }

    for (const player of players) {
        if (player.name === targetName) continue;
        const coronaBuff = getCoronaBuffForTarget(player.name, targetName);
        if (!coronaBuff) continue;
        if (!coronaDamageTypeMatches(coronaBuff, damageType)) continue;
        if (await coronaBearerReaches(player.name, targetName, coronaRangeFt(coronaBuff), mapData)) {
            return { disadvantage: true, source: player.name };
        }
    }
    return { disadvantage: false };
}

// Sync lane for save consumers that cannot await (aoeService). The caller
// carries the active map document (players + placedItems) in mapData: a
// positioned bearer↔victim pair is measured with the pure comparator
// (identical math to isWithinRange); unmeasurable pairs keep the lenient
// gridless convention above.
export function getCoronaSaveDisadvantageSync({ targetName, mapData, damageType, campaignName }) {
    let players = resolveCoronaPlayers(mapData);
    if (!players.length) {
        const combatSummary = getCombatSummary(campaignName);
        players = (combatSummary?.creatures || []).filter(c => c.type === 'player');
    }
    for (const player of players) {
        if (player.name === targetName) continue;
        const coronaBuff = getCoronaBuffForTarget(player.name, targetName);
        if (!coronaBuff) continue;
        if (!coronaDamageTypeMatches(coronaBuff, damageType)) continue;
        const bearer = findMapToken(mapData, player.name);
        const victim = findMapToken(mapData, targetName);
        if (hasTokenPosition(bearer) && hasTokenPosition(victim)
            && !isDistanceInRange(getDistanceFeet(bearer, victim), coronaRangeFt(coronaBuff))) continue;
        return { disadvantage: true, source: player.name };
    }
    return { disadvantage: false };
}
