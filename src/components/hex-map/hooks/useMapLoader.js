import { useState, useEffect, useRef, useCallback } from 'react';
import * as mapsService from '../../../services/maps/mapsService.js';
import { hexKey } from '../../../services/maps/hexMapUtils.js';
import { getDailyHexBudget } from '../../../services/campaign/travelService.js';
import { DEFAULT_GRID_SIZE, GRID_COLS_MULTIPLIER, MIN_ZOOM, DEFAULT_TERRAIN } from '../../../config/outdoorConfig.js';

function normalizeExistingView(existing) {
    const loadedZoom = existing.zoom != null ? Math.max(MIN_ZOOM, existing.zoom) : MIN_ZOOM;
    const isOldDefault = existing.panX === 0 && existing.panY === 0;
    const loadedPanX = (!isOldDefault && existing.panX != null) ? existing.panX : 0;
    const loadedPanY = (!isOldDefault && existing.panY != null) ? existing.panY : 0;
    return { loadedZoom, loadedPanX, loadedPanY, isOldDefault };
}

function buildTravelInit(loadedTravel) {
    return {
        forcedMarchHours: typeof loadedTravel.forcedMarchHours === 'number' ? loadedTravel.forcedMarchHours : 0,
        accruedCost: typeof loadedTravel.accruedCost === 'number' ? loadedTravel.accruedCost : 0,
        dailyBudget: typeof loadedTravel.dailyBudget === 'number' ? loadedTravel.dailyBudget : getDailyHexBudget(loadedTravel.travelPace || 'normal'),
        travelMode: loadedTravel.travelMode || 'inactive',
        travelPace: loadedTravel.travelPace || 'normal',
        destination: loadedTravel.destination || null,
        path: Array.isArray(loadedTravel.path) ? loadedTravel.path : [],
        pathIndex: typeof loadedTravel.pathIndex === 'number' ? loadedTravel.pathIndex : 0,
    };
}

function applyExistingMap(existing, mapName, characters, ctx) {
    const loadedTerrain = existing.terrain || {};
    const loadedRivers = existing.rivers || [];
    const loadedRoads = existing.roads || [];
    const loadedPois = existing.pois || [];
    const loadedGridSize = existing.gridSize || DEFAULT_GRID_SIZE;
    const { loadedZoom, loadedPanX, loadedPanY, isOldDefault } = normalizeExistingView(existing);

    if (!existing.type) existing.type = 'outdoor';

    ctx.setMapData(existing);
    ctx.setGridSize(loadedGridSize);
    ctx.setTerrain(loadedTerrain);
    ctx.setRivers(loadedRivers);
    ctx.setRoads(loadedRoads);
    ctx.setPois(loadedPois);
    ctx.setZoom(loadedZoom);
    ctx.setPanX(loadedPanX);
    ctx.setPanY(loadedPanY);
    ctx.hexMapDisplayNameRef.current = existing.displayName || mapName;
    if (existing.weather) ctx.setWeather(existing.weather);

    const travelInitData = buildTravelInit(existing.travelState || {});
    const hasActiveTravel = travelInitData.travelMode !== 'inactive' || travelInitData.destination !== null;
    if (hasActiveTravel) {
        ctx.setTravelInit(travelInitData);
    }

    if (isOldDefault) {
        ctx.needsResetViewRef.current = true;
    }

    const loadOrder = existing.marchingOrder ||
        (characters.length > 0 ? characters.map(c => c.name) : []);
    ctx.setMarchingOrder(loadOrder);

    if (existing.partyPosition) {
        ctx.setPartyPosition(existing.partyPosition);
    } else {
        const centerCols = loadedGridSize * GRID_COLS_MULTIPLIER;
        ctx.setPartyPosition({ q: Math.floor(centerCols / 2), r: Math.floor(loadedGridSize / 2) });
    }

    ctx.hasLoaded.current = true;
    ctx.setLoading(false);
}

function buildInitialMapData(characters) {
    const initialTerrain = {};
    const newCols = DEFAULT_GRID_SIZE * GRID_COLS_MULTIPLIER;
    const newRows = DEFAULT_GRID_SIZE;
    for (let r = 0; r < newRows; r++) {
        for (let q = 0; q < newCols; q++) {
            initialTerrain[hexKey(q, r)] = DEFAULT_TERRAIN;
        }
    }

    const initialOrder = characters.length > 0 ? characters.map(c => c.name) : [];
    const initialPartyPos = initialOrder.length > 0
        ? { q: Math.floor(newCols / 2), r: Math.floor(newRows / 2) }
        : null;

    const newData = {
        type: 'outdoor',
        gridSize: DEFAULT_GRID_SIZE,
        terrain: initialTerrain,
        pois: [],
        roads: [],
        zoom: MIN_ZOOM,
        marchingOrder: initialOrder,
        partyPosition: initialPartyPos,
    };

    return { initialTerrain, initialOrder, initialPartyPos, newData };
}

async function createAndSaveNewMap(campaignName, mapName, characters, ctx) {
    const { initialTerrain, initialOrder, initialPartyPos, newData } = buildInitialMapData(characters);

    ctx.setMapData(newData);
    ctx.setTerrain(initialTerrain);
    ctx.setGridSize(DEFAULT_GRID_SIZE);
    ctx.setMarchingOrder(initialOrder);
    ctx.setPartyPosition(initialPartyPos);
    ctx.setZoom(MIN_ZOOM);
    ctx.setPanX(0);
    ctx.setPanY(0);
    ctx.needsResetViewRef.current = true;

    try {
        await mapsService.saveMapData(campaignName, mapName, newData);
    } catch (err) {
        console.error('Failed to save initial hex map data:', err);
    }

    ctx.hasLoaded.current = true;
    ctx.setLoading(false);
}

function useMapLoader(campaignName, mapName, characters) {
    const [loading, setLoading] = useState(true);
    const [mapData, setMapData] = useState(null);
    const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
    const [terrain, setTerrain] = useState({});
    const [rivers, setRivers] = useState([]);
    const [roads, setRoads] = useState([]);
    const [pois, setPois] = useState([]);
    const [marchingOrder, setMarchingOrder] = useState([]);
    const [partyPosition, setPartyPosition] = useState(null);
    const [weather, setWeather] = useState(null);
    const [travelInit, setTravelInit] = useState(null);
    const [travelSaveVersion, setTravelSaveVersion] = useState(0);
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);

    const isInitialized = useRef(false);
    const hasLoaded = useRef(false);
    const needsResetViewRef = useRef(false);
    const hexMapNameRef = useRef(mapName);
    const hexMapDisplayNameRef = useRef(mapName);
    const travelStateRef = useRef(null);

    const setTravelStateRef = useCallback((ts) => {
        travelStateRef.current = ts;
        setTravelSaveVersion(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

        const ctx = {
            setMapData, setGridSize, setTerrain, setRivers, setRoads, setPois,
            setZoom, setPanX, setPanY, setWeather, setTravelInit,
            setMarchingOrder, setPartyPosition, setLoading,
            hexMapDisplayNameRef, needsResetViewRef, hasLoaded,
        };

        const loadMap = async () => {
            try {
                const existing = await mapsService.loadMapData(campaignName, mapName);
                if (existing) {
                    applyExistingMap(existing, mapName, characters, ctx);
                    return;
                }
            } catch (_err) {
                // ignore, fall through to empty map creation
            }

            await createAndSaveNewMap(campaignName, mapName, characters, ctx);
        };

        loadMap();
    }, [campaignName, mapName, characters]);

    useEffect(() => {
        if (!hasLoaded.current) return;
        if (mapName !== hexMapNameRef.current) return;

        const dataToSave = {
            type: 'outdoor',
            displayName: hexMapDisplayNameRef.current,
            gridSize,
            terrain,
            rivers,
            roads,
            pois,
            zoom,
            panX,
            panY,
            marchingOrder,
            partyPosition,
            weather,
            travelState: travelStateRef.current,
        };
        mapsService.saveMapData(campaignName, mapName, dataToSave)
            .catch(err => console.error('Failed to save hex map data:', err));
    }, [campaignName, mapName, terrain, rivers, roads, pois, gridSize, zoom, panX, panY, marchingOrder, partyPosition, weather, travelSaveVersion]);

    return {
        loading, mapData, setMapData,
        gridSize, setGridSize,
        terrain, setTerrain,
        rivers, setRivers,
        roads, setRoads,
        pois, setPois,
        marchingOrder, setMarchingOrder,
        partyPosition, setPartyPosition,
        weather, setWeather,
        travelInit, setTravelInit,
        travelSaveVersion,
        travelStateRef, setTravelStateRef,
        zoom, setZoom,
        panX, setPanX,
        panY, setPanY,
        needsResetViewRef,
        hexMapNameRef,
        hexMapDisplayNameRef,
    };
}

export default useMapLoader;
