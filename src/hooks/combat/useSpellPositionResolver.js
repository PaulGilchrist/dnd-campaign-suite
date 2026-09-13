import { useRef, useCallback } from 'react'
import * as mapsService from '../../services/maps/mapsService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getNearestPlacedItem } from '../../services/rules/combat/rangeValidation.js';

function resolveTargetPos(mapData, target, attackerPlayer) {
    const targetPlayer = mapData?.players?.find(p => p.name === target.name);
    if (targetPlayer) return { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
    const targetNpc = mapData?.placedItems?.length
        ? getNearestPlacedItem(mapData.placedItems, target.name, attackerPlayer)
        : null;
    if (targetNpc) return { gridX: targetNpc.gridX, gridY: targetNpc.gridY };
    return null;
}

export function useSpellPositionResolver(campaignName, mapName, playerName) {
    const cachedPosRef = useRef(null);

    const resolvePositions = useCallback(async () => {
        if (!mapName) return;
        try {
            const [mapData] = await Promise.race([
                mapsService.loadMapData(campaignName, mapName),
                new Promise((_, reject) => setTimeout(() => reject(new Error('loadMapData timeout')), 3000)),
            ]);
            const attackerPlayer = mapData?.players?.find(p => p.name === playerName);
            if (!attackerPlayer) return;
            const cs = await getCombatContext(campaignName);
            const target = cs ? getTargetFromAttacker(cs, playerName) : null;
            if (!target) return;
            const targetPos = resolveTargetPos(mapData, target, attackerPlayer);
            if (targetPos) {
                cachedPosRef.current = {
                    attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                    targetPos,
                };
            }
        } catch { /* positions unavailable */ }
    }, [mapName, campaignName, playerName]);

    return { resolvePositions, cachedPosRef };
}
