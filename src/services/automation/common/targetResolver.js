import { getCombatContext, getTargetFromAttacker } from '../../rules/damageUtils.js';
import * as mapsService from '../../maps/mapsService.js';
import { getNearestPlacedItem } from '../../rules/rangeValidation.js';

export function resolveTarget(campaignName, attackerName) {
    return getCombatContext(campaignName).then(cs => {
        if (!cs) return null;
        const target = getTargetFromAttacker(cs, attackerName);
        if (!target) return null;
        return { target, cs };
      });
}

export function resolveMapPositions(campaignName, mapName, attackerName) {
    if (!mapName) return Promise.resolve(null);

    return mapsService.loadMapData(campaignName, mapName)
         .then(mapData => {
            const attackerPlayer = mapData?.players?.find(p => p.name === attackerName);
            if (!attackerPlayer) return null;

            return resolveTarget(campaignName, attackerName).then(({ target }) => {
                if (!target) return {
                    attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                  };

                const targetPlayer = mapData?.players?.find(p => p.name === target.name);
                const targetNpc = mapData?.placedItems?.length
                     ? getNearestPlacedItem(mapData.placedItems, target.name, attackerPlayer)
                     : null;
                const targetPos = targetPlayer
                     ? { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY }
                     : targetNpc ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY } : null;

                return {
                    attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                    targetPos,
                  };
               });
          })
         .catch(() => null);
}
