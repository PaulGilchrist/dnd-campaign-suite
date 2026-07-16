import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export async function getLionDisadvantageAgainst({ attackerName, mapData }) {
    const players = mapData?.players?.length ? mapData.players : [];
    if (!players.length) return { disadvantage: false };

    for (const player of players) {
        if (player.name === attackerName) continue;
        const buffs = getRuntimeValue(player.name, 'activeBuffs') || [];
        const lionBuff = Array.isArray(buffs) ? buffs.find(b => b.optionName === 'Lion') : null;
        if (!lionBuff) continue;

        const range = lionBuff.range || '5 ft';
        const rangeNum = parseInt(range) || 5;

        const inRange = await isWithinRange(player.name, attackerName, rangeNum);
        if (!inRange) continue;

        return { disadvantage: true, source: player.name };
    }
    return { disadvantage: false };
}
