import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export function getWolfAdvantageAgainst({ targetPos, attackerName, campaignName, mapData, skipRangeCheck }) {
    if (!skipRangeCheck && (!targetPos || !mapData?.players?.length)) return { advantage: false };

    if (!skipRangeCheck) {
        for (const player of mapData.players) {
            if (player.name === attackerName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            const wolfBuff = Array.isArray(buffs) ? buffs.find(b => b.name === 'Rage of the Wilds' && b.optionName === 'Wolf') : null;
            if (!wolfBuff) continue;

            const dist = getDistanceFeet(
                { gridX: player.gridX, gridY: player.gridY },
                { gridX: targetPos.gridX, gridY: targetPos.gridY }
            );
            if (dist !== null && dist <= 5) {
                return { advantage: true, source: player.name };
            }
        }
    } else {
        for (const player of (mapData?.players || [])) {
            if (player.name === attackerName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            const wolfBuff = Array.isArray(buffs) ? buffs.find(b => b.name === 'Rage of the Wilds' && b.optionName === 'Wolf') : null;
            if (wolfBuff) {
                return { advantage: true, source: player.name };
            }
        }
    }
    return { advantage: false };
}
