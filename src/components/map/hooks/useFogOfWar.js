import { useMemo } from 'react';
import { computeVisibility } from '../../../services/maps/lineOfSight.js';
import { computeEffectiveWalls } from '../../../services/maps/effectiveWalls.js';
import { computeClosedDoors } from '../../../services/maps/reachability.js';

function useFogOfWar(players, walls, placedItems, gridSize) {
    return useMemo(() => {
        if (!gridSize) return new Set();

        const closedDoors = computeClosedDoors(placedItems);
        const fogSet = new Set();

        if (!players || players.length === 0) {
            for (let x = 0; x < gridSize; x++) {
                for (let y = 0; y < gridSize; y++) {
                    fogSet.add(`${x},${y}`);
                }
            }
            return fogSet;
        }

        const effectiveWalls = computeEffectiveWalls(walls, placedItems);
        const visible = computeVisibility(players, effectiveWalls, closedDoors, gridSize);

        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                if (!visible.has(`${x},${y}`)) {
                    fogSet.add(`${x},${y}`);
                }
            }
        }
        return fogSet;
    }, [players, walls, placedItems, gridSize]);
}

export default useFogOfWar;
