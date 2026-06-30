import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';

function getPlayersList(mapData, campaignName) {
    if (mapData?.players?.length) return mapData.players;
    const combatSummary = getCombatSummary(campaignName);
    return combatSummary?.creatures?.filter(c => c.type === 'player') || [];
}

function isInCoronaEnemiesList(sourceName, targetName, campaignName) {
    const storedEnemies = getRuntimeValue(sourceName, 'coronaOfLightEnemies', campaignName) || [];
    console.log('[Corona] isInCoronaEnemiesList source=%s target=%s storedEnemies=%o', sourceName, targetName, storedEnemies);
    if (!Array.isArray(storedEnemies)) return true;
    if (!storedEnemies.length) return true;
    if (typeof storedEnemies[0] !== 'string') return true;
    return storedEnemies.includes(targetName);
}

export function getCoronaSaveDisadvantage({ targetName, campaignName, mapData, damageType, skipRangeCheck }) {
    console.log('[Corona] getCoronaSaveDisadvantage target=%s campaign=%s skipRangeCheck=%o damageType=%s', targetName, campaignName, skipRangeCheck, damageType);
    const players = getPlayersList(mapData, campaignName);
    console.log('[Corona] players=%o', (players || []).map(p => p.name));
    if (!skipRangeCheck && !players.length) return { disadvantage: false };

    if (!skipRangeCheck) {
        let target = mapData?.players?.find(p => p.name === targetName);
        if (!target) {
            target = mapData?.placedItems?.find(i => i.name === targetName);
        }
        console.log('[Corona] map target=%o', target ? { name: target.name, gridX: target.gridX, gridY: target.gridY } : null);
        if (!target) return { disadvantage: false };

        for (const player of players) {
            if (player.name === targetName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            console.log('[Corona] checking player=%s buffs=%o', player.name, Array.isArray(buffs) ? buffs.map(b => ({ name: b.name, effect: b.effect, distance: b.distance, enemiesDisadvantageSaves: b.enemiesDisadvantageSaves })) : buffs);
            const coronaBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'sunlight_aura') : null;
            if (!coronaBuff) continue;
            console.log('[Corona] found corona buff for player=%s', player.name);

            const inList = isInCoronaEnemiesList(player.name, targetName, campaignName);
            console.log('[Corona] target %s in enemies list for %s: %s', targetName, player.name, inList);
            if (!inList) continue;

            const range = coronaBuff.distance || '60 ft';
            const rangeNum = parseInt(range) || 60;
            console.log('[Corona] range=%s rangeNum=%d', range, rangeNum);

            const playerPos = { gridX: player.gridX, gridY: player.gridY };
            const targetPos = { gridX: target.gridX, gridY: target.gridY };
            if (targetPos.gridX == null || targetPos.gridY == null) {
                console.log('[Corona] target has no position');
                continue;
            }

            const dist = getDistanceFeet(playerPos, targetPos);
            console.log('[Corona] distance=%d', dist);
            if (dist !== null && dist <= rangeNum) {
                const applicableTypes = coronaBuff.enemiesDisadvantageSaves || [];
                console.log('[Corona] applicableTypes=%o', applicableTypes);
                if (damageType && applicableTypes.length > 0) {
                    const normalizedType = damageType.charAt(0).toUpperCase() + damageType.slice(1).toLowerCase();
                    console.log('[Corona] damageType=%s normalizedType=%s match=%s', damageType, normalizedType, applicableTypes.includes(normalizedType));
                    if (!applicableTypes.includes(normalizedType)) continue;
                }
                console.log('[Corona] DISADVANTAGE applied by %s', player.name);
                return { disadvantage: true, source: player.name };
            }
        }
    } else {
        for (const player of players) {
            if (player.name === targetName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            console.log('[Corona] skipRangeCheck checking player=%s buffs=%o', player.name, Array.isArray(buffs) ? buffs.map(b => ({ name: b.name, effect: b.effect, enemiesDisadvantageSaves: b.enemiesDisadvantageSaves })) : buffs);
            const coronaBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'sunlight_aura') : null;
            if (!coronaBuff) continue;
            console.log('[Corona] skipRangeCheck found corona buff for player=%s', player.name);

            const inList = isInCoronaEnemiesList(player.name, targetName, campaignName);
            console.log('[Corona] skipRangeCheck target %s in enemies list for %s: %s', targetName, player.name, inList);
            if (!inList) continue;

            const applicableTypes = coronaBuff.enemiesDisadvantageSaves || [];
            console.log('[Corona] skipRangeCheck applicableTypes=%o', applicableTypes);
            if (damageType && applicableTypes.length > 0) {
                const normalizedType = damageType.charAt(0).toUpperCase() + damageType.slice(1).toLowerCase();
                console.log('[Corona] skipRangeCheck damageType=%s normalizedType=%s match=%s', damageType, normalizedType, applicableTypes.includes(normalizedType));
                if (!applicableTypes.includes(normalizedType)) continue;
            }
            console.log('[Corona] skipRangeCheck DISADVANTAGE applied by %s', player.name);
            return { disadvantage: true, source: player.name };
        }
    }
    console.log('[Corona] no disadvantage found');
    return { disadvantage: false };
}
