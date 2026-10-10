import { useState, useEffect, useRef, useCallback } from 'react';
import * as mapsService from '../../../services/maps/mapsService';
import { DEFAULT_GRID_SIZE } from '../../../config/mapConfig';

const AUTOSAVE_DEBOUNCE_MS = 1000;

function buildSavePayload(mapData, gridSize, placedItems) {
    return {
        ...mapData,
        gridSize,
        walls: Array.from(mapData.walls || []),
        placedItems,
    };
}

function useMapLoader({ campaignName, characters, mapName, gridSize, setGridSize }) {
    const [mapData, setMapData] = useState(null);
    const [placedItems, setPlacedItems] = useState([]);
    const svgLoadInProgressRef = useRef(false);
    const loadedMapNameRef = useRef(null);
    const pendingSaveRef = useRef(null);
    const saveTimerRef = useRef(null);

    const flushSave = useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        const pending = pendingSaveRef.current;
        if (!pending) return;
        pendingSaveRef.current = null;
        mapsService.saveMapData(pending.campaignName, pending.mapName, pending.dataToSave)
            .catch(err => console.error('Failed to save map data:', err));
    }, []);

    useEffect(() => {
        if (loadedMapNameRef.current === mapName) return;
        loadedMapNameRef.current = mapName;
        svgLoadInProgressRef.current = true;

        const loadMap = async () => {
            try {
                const existing = await mapsService.loadMapData(campaignName, mapName);
                if (existing) {
                    const walls = existing.walls ? new Set(existing.walls) : new Set();
                    setMapData({ ...existing, walls, revealed: existing.revealed || [] });
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
            } catch (_err) {
                // ignore, fall through to empty map creation
            }

            const newData = { players: [], walls: new Set() };
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
        const pending = pendingSaveRef.current;
        if (pending && (pending.mapName !== mapName || pending.campaignName !== campaignName)) {
            flushSave();
        }
        if (!mapData) return;
        if (svgLoadInProgressRef.current) return;
        pendingSaveRef.current = {
            campaignName,
            mapName,
            dataToSave: buildSavePayload(mapData, gridSize, placedItems),
        };
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(flushSave, AUTOSAVE_DEBOUNCE_MS);
    }, [mapData, campaignName, gridSize, placedItems, mapName, flushSave]);

    useEffect(() => flushSave, []); // eslint-disable-line react-hooks/exhaustive-deps

    return { mapData, setMapData, placedItems, setPlacedItems, loadInProgressRef: svgLoadInProgressRef, flushSave };
}

export default useMapLoader;
