import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function isInCoronaEnemiesList(sourceName, targetName) {
    const storedEnemies = getRuntimeValue(sourceName, 'coronaOfLightEnemies') || [];
    if (!Array.isArray(storedEnemies)) return true;
    if (!storedEnemies.length) return true;
    if (typeof storedEnemies[0] !== 'string') return true;
    return storedEnemies.includes(targetName);
}

export async function getCoronaSaveDisadvantage({ targetName, mapData, damageType }) {
    const players = mapData?.players?.length ? mapData.players : [];
    if (!players.length) return { disadvantage: false };

    for (const player of players) {
        if (player.name === targetName) continue;
        const buffs = getRuntimeValue(player.name, 'activeBuffs') || [];
        const coronaBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'sunlight_aura') : null;
        if (!coronaBuff) continue;

        const inList = isInCoronaEnemiesList(player.name, targetName);
        if (!inList) continue;

        const range = coronaBuff.distance || '60 ft';
        const rangeNum = parseInt(range) || 60;

        const inRange = await isWithinRange(player.name, targetName, rangeNum);
        if (!inRange) continue;

        const applicableTypes = coronaBuff.enemiesDisadvantageSaves || [];
        if (applicableTypes.length === 0) continue;
        if (damageType) {
            const normalizedType = damageType.charAt(0).toUpperCase() + damageType.slice(1).toLowerCase();
            if (!applicableTypes.includes(normalizedType)) continue;
        }
        return { disadvantage: true, source: player.name };
    }
    return { disadvantage: false };
}
