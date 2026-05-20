import { useCallback } from 'react';

function useSSESync({ campaignName, mapName, setGridSize, setMapData, setPlacedItems, setFog }) {
    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.data) return;
        const expectedKey = `map-data-${campaignName}-${mapName}`;
        if (event.key !== expectedKey) return;

        const data = event.data;
        if (data.gridSize !== undefined) {
            setGridSize(data.gridSize);
        }
        setMapData((prev) => ({
            ...prev,
            creatures: data.creatures || prev?.creatures || [],
            walls: data.walls ? new Set(data.walls) : (prev?.walls || new Set())
        }));
        if (data.placedItems !== undefined) {
            setPlacedItems(data.placedItems);
        }
        if (data.fog !== undefined) {
            setFog(new Set(data.fog));
        }
    }, [campaignName, mapName]);

    return { handleSSEEvent };
}

export default useSSESync;
