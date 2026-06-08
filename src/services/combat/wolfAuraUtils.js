import { getDistanceFeet } from '../rules/rangeValidation.js';
import { getRuntimeValue } from '../../hooks/useRuntimeState.js';

export function getWolfAdvantageAgainst({ targetPos, attackerName, campaignName, mapData }) {
    if (!targetPos || !mapData?.players?.length) return { advantage: false };

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
    return { advantage: false };
}
