import { useCallback } from 'react';
import useSSEEqualityGuard from '../../../hooks/useSSEEqualityGuard';

/**
 * WARNING: SSE re-render loop risk
 * All setters called in this handler are wrapped with useSSEEqualityGuard so
 * that echoed-back updates identical to current state are ignored.  This prevents
 * re-render loops when the local client's own changes come back through publish().
 */
function useSSESync({ campaignName, mapName, setGridSize, setMapData, setPlacedItems }) {
    const setGridSizeGuarded = useSSEEqualityGuard(setGridSize);
    const setMapDataGuarded = useSSEEqualityGuard(setMapData);
    const setPlacedItemsGuarded = useSSEEqualityGuard(setPlacedItems);

    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.data) return;
        const expectedKey = `map-data-${campaignName}-${mapName}`;
        if (event.key !== expectedKey) return;

        const data = event.data;
        if (data.gridSize !== undefined) {
            setGridSizeGuarded(data.gridSize);
          }
        setMapDataGuarded((prev) => ({
             ...prev,
            players: (data.players || prev?.players || []).map(({ ...rest }) => rest),
            walls: data.walls ? new Set(data.walls) : (prev?.walls || new Set())
          }));
        if (data.placedItems !== undefined) {
            setPlacedItemsGuarded(data.placedItems);
          }
      }, [campaignName, mapName, setGridSizeGuarded, setMapDataGuarded, setPlacedItemsGuarded]);

    return { handleSSEEvent };
}

export default useSSESync;
