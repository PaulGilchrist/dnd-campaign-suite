import { useCallback } from 'react';
import utils from '../../../services/ui/utils';

function useMapDrops({ isLocalhost, getGridFromEvent, setMapData, setPlacedItems }) {
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
                return {
                    ...prev,
                    players: [...existing, {
                        id: charName.toLowerCase().replace(/\s+/g, '-'),
                        name: charName,
                        gridX: gx,
                        gridY: gy,
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
    }, [isLocalhost, getGridFromEvent, setMapData, setPlacedItems]);

    return { handleDrop };
}

export default useMapDrops;
