import { useRef, useCallback } from 'react'
import * as mapsService from '../../services/maps/mapsService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getNearestPlacedItem } from '../../services/rules/combat/rangeValidation.js';

// #946: cache-side coord-validity guard, house hasGridPos canon
// (lineOfSightGate.js:39, rangeCheck.js:23, spellOverlayService.js:45) —
// BOTH coords finite, strict (no coercion). A half-coord entry is truthy so
// it slips past the executor's computeRange:16 !guard, getDistanceFeet
// turns it into a NaN distance, and computeRangeEffect reads NaN as an
// out-of-range AUTO-MISS. Cache-MISS is the graceful arm (computeRange
// returns {} / LOS gate allows ungated), so an invalid resolve silently
// leaves cachedPosRef untouched — never a half-entry. Name-only matching is
// house convention (LOS gate resolves by name too) and intentionally kept.
function hasGridPos(p) {
    return !!p && Number.isFinite(p.gridX) && Number.isFinite(p.gridY);
}

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
            if (!hasGridPos(attackerPlayer)) return;
            const cs = await getCombatContext(campaignName);
            const target = cs ? getTargetFromAttacker(cs, playerName) : null;
            if (!target) return;
            const targetPos = resolveTargetPos(mapData, target, attackerPlayer);
            if (hasGridPos(targetPos)) {
                cachedPosRef.current = {
                    attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                    targetPos,
                };
            }
        } catch { /* positions unavailable */ }
    }, [mapName, campaignName, playerName]);

    return { resolvePositions, cachedPosRef };
}
