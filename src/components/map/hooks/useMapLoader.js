import { useState, useEffect, useRef } from 'react';
import * as mapsService from '../../services/mapsService';
import { DEFAULT_GRID_SIZE } from '../../config/mapConfig';

function useMapLoader({ campaignName, characters, mapName, gridSize, setGridSize }) {
    const [mapData, setMapData] = useState(null);
    const [placedItems, setPlacedItems] = useState([]);
    const svgLoadInProgressRef = useRef(false);
    const loadedMapNameRef = useRef(null);

    useEffect(() => {
        if (loadedMapNameRef.current === mapName) return;
        loadedMapNameRef.current = mapName;
        svgLoadInProgressRef.current = true;

        const loadMap = async () => {
            try {
                const existing = await mapsService.loadMapData(campaignName, mapName);
                if (existing) {
                    const walls = existing.walls ? new Set(existing.walls) : new Set();
                    setMapData({ ...existing, walls });
                    setGridSize(existing.gridSize || DEFAULT_GRID_SIZE);
                    setPlacedItems(existing.placedItems || []);

                    if (characters && characters.length > 0) {
                        const charNames = new Set(characters.map(c => c.name));
                        const existingPlayers = existing.players || [];
                        const reconciled = existingPlayers.filter(p => charNames.has(p.name));
                        if (reconciled.length !== existingPlayers.length) {
                            setMapData(prev => ({ ...prev, players: reconciled }));
                        }
                    }
                    return;
                }
            } catch (err) {
                // ignore, fall through to empty map creation
            }

            const newData = { players: [], walls: new Set(), rooms: [] };
            setMapData(newData);
            const dataToSave = {
                ...newData,
                gridSize,
                walls: [],
                placedItems: [],
            };
            mapsService.saveMapData(campaignName, mapName, dataToSave).catch(err => console.error('Failed to save initial map data:', err));
        };

        loadMap().finally(() => { svgLoadInProgressRef.current = false; });
    }, [campaignName, characters, mapName, gridSize]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!mapData) return;
        if (svgLoadInProgressRef.current) return;
        const dataToSave = {
            ...mapData,
            gridSize,
            walls: Array.from(mapData.walls || []),
            placedItems: placedItems,
            rooms: mapData.rooms || [],
        };
        mapsService.saveMapData(campaignName, mapName, dataToSave).catch(err => console.error('Failed to save map data:', err));
    }, [mapData, campaignName, gridSize, placedItems, mapName]);

    return { mapData, setMapData, placedItems, setPlacedItems, loadInProgressRef: svgLoadInProgressRef };
}

export default useMapLoader;
