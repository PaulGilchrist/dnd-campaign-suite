import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';

function getPlayersList(mapData, campaignName) {
    if (mapData?.players?.length) return mapData.players;
    const combatSummary = getCombatSummary(campaignName);
    return combatSummary?.creatures?.filter(c => c.type === 'player') || [];
}

export function getDuplicityAdvantageAgainst({ targetPos, attackerName, campaignName, mapData, skipRangeCheck }) {
    const players = getPlayersList(mapData, campaignName);
    if (!skipRangeCheck && (!targetPos || !players.length)) return { advantage: false };

    if (!skipRangeCheck) {
        for (const player of players) {
            if (player.name === attackerName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            const illusionBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'create_illusion' && b.isImprovedDuplicity) : null;
            if (!illusionBuff) continue;

            const dist = getDistanceFeet(
                { gridX: player.gridX, gridY: player.gridY },
                { gridX: targetPos.gridX, gridY: targetPos.gridY }
            );
            if (dist !== null && dist <= 5) {
                return { advantage: true, source: player.name };
            }
        }
    } else {
        for (const player of players) {
            if (player.name === attackerName) continue;
            const buffs = getRuntimeValue(player.name, 'activeBuffs', campaignName) || [];
            const illusionBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'create_illusion' && b.isImprovedDuplicity) : null;
            if (illusionBuff) {
                return { advantage: true, source: player.name };
            }
        }
    }
    return { advantage: false };
}
