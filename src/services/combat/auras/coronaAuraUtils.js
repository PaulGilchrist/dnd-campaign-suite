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
    if (!Array.isArray(storedEnemies)) return true;
    if (!storedEnemies.length) return true;
    if (typeof storedEnemies[0] !== 'string') return true;
    return storedEnemies.includes(targetName);
}

export function getCoronaSaveDisadvantage({ targetName, campaignName, mapData, damageType, skipRangeCheck }) {
    const players = getPlayersList(mapData, campaignName);
    if (!skipRangeCheck && !players.length) return { disadvantage: false };

    if (!skipRangeCheck) {
        let target = mapData?.players?.find(p => p.name === targetName);
        if (!target) {
            target = mapData?.placedItems?.find(i => i.name === targetName);
        }
        if (!target) return { disadvantage: false };

        for (const player of players) {
            if (player.name === targetName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            const coronaBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'sunlight_aura') : null;
            if (!coronaBuff) continue;

            const inList = isInCoronaEnemiesList(player.name, targetName, campaignName);
            if (!inList) continue;

            const range = coronaBuff.distance || '60 ft';
            const rangeNum = parseInt(range) || 60;

            const playerPos = { gridX: player.gridX, gridY: player.gridY };
            const targetPos = { gridX: target.gridX, gridY: target.gridY };
            if (targetPos.gridX == null || targetPos.gridY == null) {
                continue;
            }

            const dist = getDistanceFeet(playerPos, targetPos);
            if (dist !== null && dist <= rangeNum) {
                const applicableTypes = coronaBuff.enemiesDisadvantageSaves || [];
                if (damageType && applicableTypes.length > 0) {
                    const normalizedType = damageType.charAt(0).toUpperCase() + damageType.slice(1).toLowerCase();
                    if (!applicableTypes.includes(normalizedType)) continue;
                }
                return { disadvantage: true, source: player.name };
            }
        }
    } else {
        for (const player of players) {
            if (player.name === targetName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            const coronaBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'sunlight_aura') : null;
            if (!coronaBuff) continue;

            const inList = isInCoronaEnemiesList(player.name, targetName, campaignName);
            if (!inList) continue;

            const applicableTypes = coronaBuff.enemiesDisadvantageSaves || [];
            if (damageType && applicableTypes.length > 0) {
                const normalizedType = damageType.charAt(0).toUpperCase() + damageType.slice(1).toLowerCase();
                if (!applicableTypes.includes(normalizedType)) continue;
            }
            return { disadvantage: true, source: player.name };
        }
    }
    return { disadvantage: false };
}
