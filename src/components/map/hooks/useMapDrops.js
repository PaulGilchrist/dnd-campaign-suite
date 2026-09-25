import { useCallback } from 'react';
import utils from '../../../services/ui/utils';
import { computeMovementObstacles, findNearestValid } from '../../../services/maps/reachability.js';

function useMapDrops({ isLocalhost, getGridFromEvent, setMapData, setPlacedItems, placedItems, gridSize }) {
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;
        const gx = Math.floor(grid.gridX);
        const gy = Math.floor(grid.gridY);
        const dragData = e.dataTransfer.getData('text/plain');
        if (!dragData) return;

        if (dragData.startsWith('character:')) {
            const charName = dragData.slice('character:'.length);
            setMapData(prev => {
                const existing = prev.players || [];
                if (existing.some(p => p.name === charName)) return prev;
                // A new player must start on a passable cell: if the drop
                // lands on a wall or closed door, snap to the nearest
                // passable cell instead.
                const obstacles = computeMovementObstacles(prev.walls, placedItems);
                let targetX = gx;
                let targetY = gy;
                if (obstacles.has(`${gx},${gy}`)) {
                    const found = findNearestValid(gx, gy, (x, y) => !obstacles.has(`${x},${y}`), gridSize);
                    if (found) {
                        targetX = found.x;
                        targetY = found.y;
                    }
                }
                return {
                    ...prev,
                    players: [...existing, {
                        id: charName.toLowerCase().replace(/\s+/g, '-'),
                        name: charName,
                        gridX: targetX,
                        gridY: targetY,
                    }],
                };
            });
            return;
        }

        if (dragData === 'npc') {
            const newItem = {
                id: utils.guid(),
                type: 'npc',
                gridX: gx,
                gridY: gy,
                visible: isLocalhost,
                name: 'NPC',
            };
            setPlacedItems(prev => [...prev, newItem]);
            return;
        }

        const newItem = {
            id: utils.guid(),
            type: dragData,
            gridX: gx,
            gridY: gy,
            visible: isLocalhost,
            rotation: (dragData === 'table' || dragData === 'bed' || dragData === 'stairs' || dragData === 'altar' || dragData === 'bookshelf' || dragData === 'torch' || dragData === 'chair' || dragData === 'arrowSlitWall') ? 0 : undefined,
        };
        setPlacedItems(prev => [...prev, newItem]);
    }, [isLocalhost, getGridFromEvent, setMapData, setPlacedItems, placedItems, gridSize]);

    return { handleDrop };
}

export default useMapDrops;
