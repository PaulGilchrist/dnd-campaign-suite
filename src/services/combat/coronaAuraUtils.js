import { getDistanceFeet } from '../rules/combat/rangeValidation.js';
import { getRuntimeValue } from '../../hooks/useRuntimeState.js';

export function getCoronaSaveDisadvantage({ targetName, campaignName, mapData, damageType, skipRangeCheck }) {
    if (!skipRangeCheck && (!mapData?.players?.length)) return { disadvantage: false };

    if (!skipRangeCheck) {
        const target = mapData.players.find(p => p.name === targetName);
        if (!target) return { disadvantage: false };

        for (const player of mapData.players) {
            if (player.name === targetName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            const coronaBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'sunlight_aura') : null;
            if (!coronaBuff) continue;

            const range = coronaBuff.distance || '60 ft';
            const rangeNum = parseInt(range) || 60;

            const dist = getDistanceFeet(
                { gridX: player.gridX, gridY: player.gridY },
                { gridX: target.gridX, gridY: target.gridY }
            );
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
        for (const player of (mapData?.players || [])) {
            if (player.name === targetName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            const coronaBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'sunlight_aura') : null;
            if (!coronaBuff) continue;
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
