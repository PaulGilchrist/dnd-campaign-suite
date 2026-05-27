import { useCallback } from 'react';

function useSSESync({ campaignName, mapName, setGridSize, setMapData, setPlacedItems, lastSavedWallsRef }) {
    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.data) return;
        const expectedKey = `map-data-${campaignName}-${mapName}`;
        if (event.key !== expectedKey) return;

        const data = event.data;
        if (data.gridSize !== undefined) {
            setGridSize(data.gridSize);
        }
        const isEcho = data.walls && lastSavedWallsRef?.current &&
            JSON.stringify(data.walls) === JSON.stringify(lastSavedWallsRef.current);
        setMapData((prev) => ({
            ...prev,
            players: (data.players || prev?.players || []).map(({ ...rest }) => rest),
            walls: isEcho ? prev?.walls : (data.walls ? new Set(data.walls) : (prev?.walls || new Set()))
        }));
        if (data.placedItems !== undefined) {
            setPlacedItems(data.placedItems);
        }
    }, [campaignName, mapName, setGridSize, setMapData, setPlacedItems, lastSavedWallsRef]);

    return { handleSSEEvent };
}

export default useSSESync;
