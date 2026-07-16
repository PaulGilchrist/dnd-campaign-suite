import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export async function getWolfAdvantageAgainst({ attackerName, mapData }) {
    const players = mapData?.players?.length ? mapData.players : [];
    if (!players.length) return { advantage: false };

    for (const player of players) {
        if (player.name === attackerName) continue;
        const buffs = getRuntimeValue(player.name, 'activeBuffs') || [];
        const wolfBuff = Array.isArray(buffs) ? buffs.find(b => b.name === 'Rage of the Wilds' && b.optionName === 'Wolf') : null;
        if (!wolfBuff) continue;

        const inRange = await isWithinRange(player.name, attackerName, 5);
        if (!inRange) continue;

        return { advantage: true, source: player.name };
    }
    return { advantage: false };
}
