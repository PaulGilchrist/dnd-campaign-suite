import { useCallback } from 'react';

function useHexMapSSESync({ campaignName, mapName, setGridSize, setTerrain, setRivers, setPois, setZoom, setPanX, setPanY, setMarchingOrder, setPartyPosition, setMapData }) {
    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.data) return;
        const expectedKey = `map-data-${campaignName}-${mapName}`;
        if (event.key !== expectedKey) return;

        const data = event.data;
        if (data.gridSize !== undefined) {
            setGridSize(data.gridSize);
        }
        if (data.terrain !== undefined) {
            setTerrain(data.terrain);
        }
        if (data.rivers !== undefined) {
            setRivers(data.rivers);
        }
        if (data.pois !== undefined) {
            setPois(data.pois);
        }
        if (data.zoom !== undefined) {
            setZoom(data.zoom);
        }
        if (data.panX !== undefined) {
            setPanX(data.panX);
        }
        if (data.panY !== undefined) {
            setPanY(data.panY);
        }
        if (data.marchingOrder !== undefined) {
            setMarchingOrder(data.marchingOrder);
        }
        if (data.partyPosition !== undefined) {
            setPartyPosition(data.partyPosition);
        }
        if (data.type) {
            setMapData(prev => ({ ...prev, ...data }));
        }
    }, [campaignName, mapName]);

    return { handleSSEEvent };
}

export default useHexMapSSESync;
