import { useMemo } from 'react';
import { computeVisibility } from '../../../services/maps/lineOfSight.js';

function useFogOfWar(players, walls, placedItems, gridSize) {
    return useMemo(() => {
        if (!gridSize) return new Set();

        const closedDoors = new Set();
        for (const item of placedItems || []) {
            if (item.type === 'door' && !item.open) {
                closedDoors.add(`${item.gridX},${item.gridY}`);
            }
        }

        const fogSet = new Set();

        if (!players || players.length === 0) {
            for (let x = 0; x < gridSize; x++) {
                for (let y = 0; y < gridSize; y++) {
                    fogSet.add(`${x},${y}`);
                }
            }
            return fogSet;
        }

        const visible = computeVisibility(players, walls || new Set(), closedDoors, gridSize);

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
