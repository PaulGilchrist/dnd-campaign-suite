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
        if (data.gridSize !== undefined) {
            setGridSizeG(data.gridSize);
           }
        if (data.terrain !== undefined) {
            setTerrainG(data.terrain);
           }
        if (data.rivers !== undefined) {
            setRiversG(data.rivers);
           }
        if (data.pois !== undefined) {
            setPoisG(data.pois);
           }
        if (data.roads !== undefined) {
            setRoadsG(data.roads);
           }
        if (data.zoom !== undefined) {
            setZoomG(data.zoom);
           }
        if (data.panX !== undefined) {
            setPanXG(data.panX);
           }
        if (data.panY !== undefined) {
            setPanYG(data.panY);
           }
        if (data.marchingOrder !== undefined) {
            setMarchingOrderG(data.marchingOrder);
           }
        if (data.partyPosition !== undefined) {
            setPartyPositionG(data.partyPosition);
           }
        if (data.weather !== undefined) {
            setWeatherG(data.weather);
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
