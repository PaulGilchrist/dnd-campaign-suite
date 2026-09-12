import { useCallback } from 'react';
import useSSEEqualityGuard from '../../../hooks/runtime/useSSEEqualityGuard';

/**
 * WARNING: SSE re-render loop risk
 * All setters called in this handler are wrapped with useSSEEqualityGuard so
 * that echoed-back updates identical to current state are ignored.  This prevents
 * re-render loops when the local client's own changes come back through publish().
 */
function useHexMapSSESync({ campaignName, mapName, setGridSize, setTerrain, setRivers, setRoads, setPois, setZoom, setPanX, setPanY, setMarchingOrder, setPartyPosition, setMapData, setWeather, onTravelStateChange }) {
    const setGridSizeG = useSSEEqualityGuard(setGridSize);
    const setTerrainG = useSSEEqualityGuard(setTerrain);
    const setRiversG = useSSEEqualityGuard(setRivers);
    const setRoadsG = useSSEEqualityGuard(setRoads);
    const setPoisG = useSSEEqualityGuard(setPois);
    const setZoomG = useSSEEqualityGuard(setZoom);
    const setPanXG = useSSEEqualityGuard(setPanX);
    const setPanYG = useSSEEqualityGuard(setPanY);
    const setMarchingOrderG = useSSEEqualityGuard(setMarchingOrder);
    const setPartyPositionG = useSSEEqualityGuard(setPartyPosition);
    const setMapDataG = useSSEEqualityGuard(setMapData);
    const setWeatherG = useSSEEqualityGuard(setWeather);

    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.data) return;
        const expectedKey = `map-data-${campaignName}-${mapName}`;
        if (event.key !== expectedKey) return;

        const data = event.data;
        const fieldSetters = [
            ['gridSize', setGridSizeG],
            ['terrain', setTerrainG],
            ['rivers', setRiversG],
            ['pois', setPoisG],
            ['roads', setRoadsG],
            ['zoom', setZoomG],
            ['panX', setPanXG],
            ['panY', setPanYG],
            ['marchingOrder', setMarchingOrderG],
            ['partyPosition', setPartyPositionG],
            ['weather', setWeatherG],
        ];

        for (const [field, setter] of fieldSetters) {
            if (data[field] !== undefined) setter(data[field]);
        }

        if (data.travelState !== undefined && onTravelStateChange) {
            onTravelStateChange(data.travelState);
           }
        if (data.type) {
            setMapDataG(prev => ({ ...prev, ...data }));
           }
       }, [campaignName, mapName, setGridSizeG, setTerrainG, setRiversG, setRoadsG, setPoisG, setZoomG, setPanXG, setPanYG, setMarchingOrderG, setPartyPositionG, setMapDataG, setWeatherG, onTravelStateChange]);

    return { handleSSEEvent };
}

export default useHexMapSSESync;
