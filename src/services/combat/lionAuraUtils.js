import { getDistanceFeet } from '../rules/rangeValidation.js';
import { getRuntimeValue } from '../../hooks/useRuntimeState.js';

export function getLionDisadvantageAgainst({ attackerName, campaignName, mapData }) {
    if (!mapData?.players?.length) return { disadvantage: false };

    const attacker = mapData.players.find(p => p.name === attackerName);
    if (!attacker) return { disadvantage: false };

    for (const player of mapData.players) {
        if (player.name === attackerName) continue;
        const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
        const lionBuff = Array.isArray(buffs) ? buffs.find(b => b.optionName === 'Lion') : null;
        if (!lionBuff) continue;

        const range = lionBuff.range || '5 ft';
        const rangeNum = parseInt(range) || 5;

        const dist = getDistanceFeet(
            { gridX: player.gridX, gridY: player.gridY },
            { gridX: attacker.gridX, gridY: attacker.gridY }
        );
        if (dist !== null && dist <= rangeNum) {
            return { disadvantage: true, source: player.name };
        }
    }
    return { disadvantage: false };
}
