import { useMemo } from 'react';
import { computeVisibility } from '../../../services/maps/lineOfSight.js';
import { computeEffectiveWalls } from '../../../services/maps/effectiveWalls.js';
import { computeClosedDoors } from '../../../services/maps/reachability.js';

// Fog of war with persistent exploration memory. `revealed` holds the cells that
// have ever been uncovered (persisted in the map file). A cell is fogged only
// when it is neither revealed nor currently in line of sight, so areas stay
// uncovered once seen. Returns { fog, visible }: `fog` is the set of fogged
// cells (for rendering) and `visible` is the current line of sight (used to
// persist newly revealed cells).
function useFogOfWar(players, walls, placedItems, gridSize, revealed) {
    return useMemo(() => {
        const revealedSet = new Set(revealed || []);
        let visible = new Set();
        if (gridSize > 0 && players && players.length > 0) {
            const closedDoors = computeClosedDoors(placedItems);
            const effectiveWalls = computeEffectiveWalls(walls, placedItems);
            visible = computeVisibility(players, effectiveWalls, closedDoors, gridSize);
        }

        const fog = new Set();
        if (gridSize > 0) {
            for (let x = 0; x < gridSize; x++) {
                for (let y = 0; y < gridSize; y++) {
                    const key = `${x},${y}`;
                    if (!revealedSet.has(key) && !visible.has(key)) {
                        fog.add(key);
                    }
                }
            }
        }
        return { fog, visible };
    }, [players, walls, placedItems, gridSize, revealed]);
}

export default useFogOfWar;
