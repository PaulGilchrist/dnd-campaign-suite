import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';

function getPlayersList(mapData, campaignName) {
    if (mapData?.players?.length) return mapData.players;
    const combatSummary = getCombatSummary(campaignName);
    return combatSummary?.creatures?.filter(c => c.type === 'player') || [];
}

export function getLionDisadvantageAgainst({ attackerName, campaignName, mapData, skipRangeCheck }) {
    const players = getPlayersList(mapData, campaignName);
    if (!skipRangeCheck && !players.length) return { disadvantage: false };

    if (!skipRangeCheck) {
        const attacker = players.find(p => p.name === attackerName);
        if (!attacker) return { disadvantage: false };

        for (const player of players) {
            if (player.name === attackerName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            const lionBuff = Array.isArray(buffs) ? buffs.find(b => b.optionName === 'Lion') : null;
            if (!lionBuff) continue;

            const range = lionBuff.range || '5 ft';
            const rangeNum = parseInt(range) || 5;

            if (isWithinRange(
                { gridX: player.gridX, gridY: player.gridY },
                { gridX: attacker.gridX, gridY: attacker.gridY },
                rangeNum
            )) {
                return { disadvantage: true, source: player.name };
            }
        }
    } else {
        for (const player of players) {
            if (player.name === attackerName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            const lionBuff = Array.isArray(buffs) ? buffs.find(b => b.optionName === 'Lion') : null;
            if (lionBuff) {
                return { disadvantage: true, source: player.name };
            }
        }
    }
    return { disadvantage: false };
}
