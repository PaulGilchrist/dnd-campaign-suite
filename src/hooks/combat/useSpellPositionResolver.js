import { useRef, useCallback } from 'react'
import * as mapsService from '../../services/maps/mapsService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getNearestPlacedItem } from '../../services/rules/combat/rangeValidation.js';

export function useSpellPositionResolver(campaignName, mapName, playerName) {
    const cachedPosRef = useRef(null);

    const resolvePositions = useCallback(async () => {
        if (!mapName) return;
        try {
            const [mapData] = await Promise.all([
                mapsService.loadMapData(campaignName, mapName),
            ]);
            const attackerPlayer = mapData?.players?.find(p => p.name === playerName);
            if (attackerPlayer) {
                const cs = await getCombatContext(campaignName);
                const target = cs ? getTargetFromAttacker(cs, playerName) : null;
                if (target) {
                    const targetPlayer = mapData?.players?.find(p => p.name === target.name);
                    const targetNpc = mapData?.placedItems?.length
                        ? getNearestPlacedItem(mapData.placedItems, target.name, attackerPlayer)
                        : null;
                    const targetPos = targetPlayer
                        ? { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY }
                        : targetNpc
                            ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY }
                            : null;
                    if (targetPos) {
                        cachedPosRef.current = {
                            attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                            targetPos,
                        };
                    }
                }
            }
        } catch { /* positions unavailable */ }
    }, [mapName, campaignName, playerName]);

    return { resolvePositions, cachedPosRef };
}
