import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatContext, getCombatSummary } from '../../encounters/combatData.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

export async function getCoronaSaveDisadvantage({ targetName, mapData, damageType, campaignName, skipRangeCheck }) {
    let players = resolveCoronaPlayers(mapData);
    if (!players.length) {
        if (!skipRangeCheck) return { disadvantage: false };
        const combatSummary = getCombatSummary(campaignName) || await getCombatContext(campaignName);
        players = (combatSummary?.creatures || []).filter(c => c.type === 'player');
    }

    for (const player of players) {
        if (player.name === targetName) continue;
        const coronaBuff = getCoronaBuffForTarget(player.name, targetName);
        if (!coronaBuff) continue;

        if (!skipRangeCheck) {
            const range = coronaBuff.distance || '60 ft';
            const rangeNum = parseInt(range) || 60;
            const inRange = await isWithinRange(player.name, targetName, rangeNum);
            if (!inRange) continue;
        }

        if (!coronaDamageTypeMatches(coronaBuff, damageType)) continue;
        return { disadvantage: true, source: player.name };
    }
    return { disadvantage: false };
}

// CLA-063: sync lane for save consumers that cannot await (aoeService). Honors
// skipRangeCheck by treating gridless/no-position targets as consulted-and-passes;
// without the flag it cannot measure range, so it stays conservative-false.
export function getCoronaSaveDisadvantageSync({ targetName, mapData, damageType, campaignName, skipRangeCheck }) {
    if (!skipRangeCheck) return { disadvantage: false };
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
        return { disadvantage: true, source: player.name };
    }
    return { disadvantage: false };
}
