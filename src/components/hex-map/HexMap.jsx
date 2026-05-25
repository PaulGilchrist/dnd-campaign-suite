import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as mapsService from '../../services/mapsService.js';
import {
    HEX_SIZE, DEFAULT_GRID_SIZE, DEFAULT_TERRAIN, MIN_ZOOM, MAX_ZOOM,
    TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_RIVER, TOOL_PAN, TOOL_TRAVEL,
    TERRAIN_TYPES, POI_TYPES
} from '../../config/outdoorConfig.js';
import { generateRiversFromTerrain } from '../../services/hexTerrainGenerator.js';
import { hexKey, hexToPixel, pixelToHexSnapped, hexToSVGPath } from '../../services/hexMapUtils.js';
import { generateOutdoorEncounter } from '../../services/outdoorEncounterGenerator.js';
import TerrainLayer from './TerrainLayer.jsx';
import HexGridLayer from './HexGridLayer.jsx';
import HexMapToolbar from './HexMapToolbar.jsx';
import POILayer from './POILayer.jsx';
import POIPanel from './POIPanel.jsx';
import POIContextMenu from './POIContextMenu.jsx';
import MarchingOrderPanel from './MarchingOrderPanel.jsx';
import PartyMarkerLayer from './PartyMarkerLayer.jsx';
import RiverLayer from './RiverLayer.jsx';
import SettlementSVG from './svg/SettlementSVG.jsx';
import DungeonSVG from './svg/DungeonSVG.jsx';
import CampSVG from './svg/CampSVG.jsx';
import TowerSVG from './svg/TowerSVG.jsx';
import LoreSiteSVG from './svg/LoreSiteSVG.jsx';
import HazardSVG from './svg/HazardSVG.jsx';
import NaturalWonderSVG from './svg/NaturalWonderSVG.jsx';
import LandmarkSVG from './svg/LandmarkSVG.jsx';
import Subscriber from '../common/Subscriber.jsx';
import useHexMapSSESync from './hooks/useHexMapSSESync.js';
import useTravelManagement from '../../hooks/useTravelManagement.js';
import TravelPanel from './TravelPanel.jsx';
import TravelPathLayer from './TravelPathLayer.jsx';
import './HexMap.css';

function HexMap({ campaignName, mapName, onBack, characters = [], onEncounterCreated, isLocalhost = false, onPoiEntered }) {
    const [loading, setLoading] = useState(true);
    const [mapData, setMapData] = useState(null);       // full map data object from server
    const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE); // hex grid dimensions
    const [terrain, setTerrain] = useState({});          // Record<hexKey, terrainType>
    const [rivers, setRivers] = useState([]);            // array of "q,r" strings
    const [pois, setPois] = useState([]);                // array of POI objects

    // Marching order state
    const [marchingOrder, setMarchingOrder] = useState([]);  // ordered character names
    const [partyPosition, setPartyPosition] = useState(null); // {hexQ, hexR} | null
    const [marchingOpen, setMarchingOpen] = useState(false);  // panel toggle

    // Travel state
    const travelMgmt = useTravelManagement({
        gridSize,
        terrain,
        partyPosition,
        onPartyMove: setPartyPosition,
    });

    // Tool state
    const [tool, setTool] = useState(TOOL_NONE);         // current tool mode
    const [selectedTerrain, setSelectedTerrain] = useState(TERRAIN_TYPES[0].id);
    // POI interaction state
    const [poiPanelOpen, setPoiPanelOpen] = useState(false);
    const [selectedPoiMenu, setSelectedPoiMenu] = useState(null); // { id, q, r }
    const [showRename, setShowRename] = useState(null);
    const [poiDragging, setPoiDragging] = useState(null); // { poiId, startQ, startR } | null
    const [indoorMaps, setIndoorMaps] = useState([]); // available indoor maps for linking
    const validLinkedMapsRef = useRef(new Set()); // Set of linked map names that exist on server
    const [validLinkedMaps, setValidLinkedMaps] = useState(new Set()); // triggers re-render

    // Painting state
    const paintingRef = useRef(false); // whether we're in the middle of a paint/erase stroke

    const [zoom, setZoom] = useState(1.5);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [panning, setPanning] = useState(null);        // { startX, startY, startPanX, startPanY } | null
    const [hoveredHex, setHoveredHex] = useState(null);  // { q, r } | null
    const [partyContextMenu, setPartyContextMenu] = useState(null); // { q, r } | null

    const svgRef = useRef(null);
    const zoomValueRef = useRef(1);
    const panXValueRef = useRef(0);
    const panYValueRef = useRef(0);
    const accumulatedDeltaRef = useRef(0);
    const isInitialized = useRef(false);
    const hasLoaded = useRef(false);
    const toolInitRef = useRef(true);

    // Sync tool ↔ travel management state
    useEffect(() => {
        if (toolInitRef.current) {
            toolInitRef.current = false;
            return;
        }
        if (tool === TOOL_TRAVEL && travelMgmt.travelMode === 'inactive') {
            travelMgmt.startPlanning();
        } else if (tool !== TOOL_TRAVEL && travelMgmt.isTravelActive) {
            travelMgmt.cancelTravel();
        }
    }, [tool]);

    useEffect(() => {
        if (travelMgmt.travelMode === 'inactive' && tool === TOOL_TRAVEL) {
            setTool(TOOL_NONE);
        }
    }, [travelMgmt.travelMode]);

    // Fetch available indoor maps for POI linking
    useEffect(() => {
        let cancelled = false;
        mapsService.loadMaps(campaignName).then(result => {
            if (cancelled) return;
            const indoor = result.maps
                .filter(m => m.type === 'indoor')
                .map(m => m.name);
            setIndoorMaps(indoor);
        }).catch(err => console.error('[HexMap] Failed to load indoor maps:', err));
        return () => { cancelled = true; };
    }, [campaignName]);

    // Verify that linked POI maps exist on the server
    useEffect(() => {
        const linkedMaps = pois
            .filter(p => p.linkedMap)
            .map(p => p.linkedMap);
        const unique = [...new Set(linkedMaps)];
        if (unique.length === 0) {
            validLinkedMapsRef.current = new Set();
            setValidLinkedMaps(new Set());
            return;
        }
        let cancelled = false;
        Promise.allSettled(
            unique.map(name =>
                mapsService.loadMapData(campaignName, name)
                    .then(() => name)
                    .catch(() => null)
            )
        ).then(results => {
            if (cancelled) return;
            const valid = new Set(
                results
                    .filter(r => r.status === 'fulfilled' && r.value)
                    .map(r => r.value)
            );
            validLinkedMapsRef.current = valid;
            setValidLinkedMaps(valid);
        });
        return () => { cancelled = true; };
    }, [campaignName, pois]);

    const { handleSSEEvent } = useHexMapSSESync({
        campaignName, mapName, setGridSize, setTerrain, setRivers, setPois,
        setZoom, setPanX, setPanY, setMarchingOrder, setPartyPosition, setMapData,
    });

    // Computed SVG dimensions — corrected to account for full axial extent + hex shape
    const gridPixelBounds = useMemo(() => {
        const xMin = -HEX_SIZE * Math.sqrt(3) / 2;
        const xMax = HEX_SIZE * Math.sqrt(3) * ((gridSize - 1) + (gridSize - 1) / 2 + 0.5);
        const yMin = -HEX_SIZE;
        const yMax = HEX_SIZE * (1.5 * (gridSize - 1) + 1);
        return {
            width: xMax - xMin,
            height: yMax - yMin,
            offsetX: xMin,
            offsetY: yMin,
            centerX: (xMin + xMax) / 2,
            centerY: (yMin + yMax) / 2,
        };
    }, [gridSize]);

    const svgWidth = gridPixelBounds.width;
    const svgHeight = gridPixelBounds.height;

    // ─── Zoom/Pan helpers ────────────────────────────────────────────────

    const zoomIn = useCallback(() => {
        setZoom(prev => Math.min(MAX_ZOOM, prev * 1.25));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom(prev => Math.max(MIN_ZOOM, prev * 0.8));
    }, []);

    const resetView = useCallback(() => {
        setZoom(2);
        setPanX(-(HEX_SIZE * Math.sqrt(3) / 2));
        setPanY(-HEX_SIZE);
    }, []);

    const handlePanStart = useCallback((e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;
        setPanning({
            startX: svgX,
            startY: svgY,
            startPanX: panX,
            startPanY: panY
        });
    }, [panX, panY]);

    const handlePanMove = useCallback((e) => {
        if (!panning) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;
        const dx = svgX - panning.startX;
        const dy = svgY - panning.startY;
        setPanX(panning.startPanX - dx);
        setPanY(panning.startPanY - dy);
    }, [panning]);

    const handlePanEnd = useCallback(() => {
        setPanning(null);
    }, []);

    const handleWheel = useCallback((e) => {
        if (!e.metaKey) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;
        const currentZoom = zoomValueRef.current;
        const currentPanX = panXValueRef.current;
        const currentPanY = panYValueRef.current;
        accumulatedDeltaRef.current += e.deltaY;
        const accumulated = accumulatedDeltaRef.current;
        const ZOOM_THRESHOLD = 20;
        let factor = 1;
        if (accumulated < -ZOOM_THRESHOLD) {
            factor = 1.05;
            accumulatedDeltaRef.current = 0;
        } else if (accumulated > ZOOM_THRESHOLD) {
            factor = 0.95;
            accumulatedDeltaRef.current = 0;
        }
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * factor));
        const newPanX = svgX - (svgX - currentPanX) * (currentZoom / newZoom);
        const newPanY = svgY - (svgY - currentPanY) * (currentZoom / newZoom);
        setZoom(newZoom);
        setPanX(newPanX);
        setPanY(newPanY);
    }, []);

    // ─── Hex coordinate helpers ─────────────────────────────────────────

    const getHexFromEvent = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;
        return pixelToHexSnapped(svgX, svgY, HEX_SIZE);
    }, []);

    // ─── Terrain painting handlers ──────────────────────────────────────

    const handleTerrainPointerDown = useCallback((e) => {
        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= gridSize || hex.r < 0 || hex.r >= gridSize) return;
        const key = hexKey(hex.q, hex.r);
        if (tool === TOOL_RIVER) {
            setRivers(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
            paintingRef.current = true;
            return;
        }
        setTerrain(prev => {
            const next = { ...prev };
            if (tool === TOOL_PAINT) {
                next[key] = selectedTerrain;
            } else if (tool === TOOL_ERASE) {
                delete next[key];
            }
            return next;
        });
        paintingRef.current = true;
    }, [tool, selectedTerrain, gridSize, getHexFromEvent]);

    const handleTerrainPointerMove = useCallback((e) => {
        if (!paintingRef.current) return;
        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= gridSize || hex.r < 0 || hex.r >= gridSize) return;
        const key = hexKey(hex.q, hex.r);
        if (tool === TOOL_RIVER) {
            setRivers(prev => prev.includes(key) ? prev : [...prev, key]);
            return;
        }
        setTerrain(prev => {
            const next = { ...prev };
            if (tool === TOOL_PAINT) {
                next[key] = selectedTerrain;
            } else if (tool === TOOL_ERASE) {
                delete next[key];
            }
            return next;
        });
    }, [tool, selectedTerrain, gridSize, getHexFromEvent]);

    const handleTerrainPointerUp = useCallback(() => {
        paintingRef.current = false;
    }, []);

    // ─── POI drop from panel ────────────────────────────────────────────

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const dragData = e.dataTransfer.getData('text/plain');
        if (!dragData) return;

        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= gridSize || hex.r < 0 || hex.r >= gridSize) return;

        // Handle character drops from POI panel
        if (dragData.startsWith('character:')) {
            const charName = dragData.slice('character:'.length);
            // Add character to marching order if not already present
            setMarchingOrder(prev => {
                if (prev.includes(charName)) return prev;
                return [...prev, charName];
            });
            // Place party marker at drop position if none exists
            setPartyPosition(prev => prev || { q: hex.q, r: hex.r });
            return;
        }

        // Check if it's a POI type
        const poiType = POI_TYPES.find(t => t.id === dragData);
        if (!poiType) return;

        // Check if a POI already exists at this hex
        const exists = pois.some(p => p.q === hex.q && p.r === hex.r);
        if (exists) return;

        const newPoi = {
            id: `poi-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            type: poiType.id,
            q: hex.q,
            r: hex.r,
            visible: true,
            label: poiType.name,
        };
        setPois(prev => [...prev, newPoi]);
    }, [pois, gridSize, getHexFromEvent]);

    // ─── POI interaction handlers ──────────────────────────────────────

    const handlePoiPointerDown = useCallback((poiId, e) => {
        e.preventDefault();
        e.stopPropagation();
        const poi = pois.find(p => p.id === poiId);
        if (!poi) return;
        setPoiDragging({ poiId, startQ: poi.q, startR: poi.r });
    }, [pois]);

    const handlePoiPointerMove = useCallback((e) => {
        if (!poiDragging) return;
        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= gridSize || hex.r < 0 || hex.r >= gridSize) return;

        // Check no other POI at target hex
        const exists = pois.some(p => p.id !== poiDragging.poiId && p.q === hex.q && p.r === hex.r);
        if (exists) return;

        setPois(prev => prev.map(p =>
            p.id === poiDragging.poiId ? { ...p, q: hex.q, r: hex.r } : p
        ));
    }, [poiDragging, pois, gridSize, getHexFromEvent]);

    const handlePoiPointerUp = useCallback(() => {
        setPoiDragging(null);
    }, []);

    const handleGenerateRivers = useCallback(() => {
        const result = generateRiversFromTerrain(terrain, gridSize);
        setRivers(result);
    }, [terrain, gridSize]);

    const handleStartEncounter = useCallback(async (q, r) => {
        const terrainType = terrain[hexKey(q, r)] || 'plains';
        const grid = 30;
        const encounterData = generateOutdoorEncounter(terrainType, grid, marchingOrder, q, r);
        const baseMapName = mapName.replace(/\.json$/, '');
        const encounterName = `${baseMapName}-encounter-at-${q}-${r}`;

        try {
            const result = await mapsService.createMap(campaignName, encounterName, {
                type: 'indoor',
                gridSize: grid,
                placedItems: encounterData.placedItems,
                players: encounterData.players,
                fog: [],
                walls: [],
                parentTerrain: terrainType,
                parentHex: { q, r },
                bgFill: encounterData.bgFill,
            });

            // Only save if the map was freshly created (not already existing)
            if (!result?.alreadyExists) {
                await mapsService.saveMapData(campaignName, encounterName, encounterData);
            }

            if (onEncounterCreated) {
                onEncounterCreated(encounterName);
            }
        } catch (err) {
            console.error('[handleStartEncounter] FAILED:', err);
        }
    }, [campaignName, mapName, terrain, marchingOrder, onEncounterCreated]);

    const handlePoiContextMenu = useCallback((poiId, e) => {
        const poi = pois.find(p => p.id === poiId);
        if (!poi) return;
        setSelectedPoiMenu({ id: poi.id, q: poi.q, r: poi.r });
    }, [pois]);

    const handleTogglePoiVisibility = useCallback((poiId) => {
        setPois(prev => prev.map(p =>
            p.id === poiId ? { ...p, visible: !p.visible } : p
        ));
        setSelectedPoiMenu(null);
    }, []);

    const handleDeletePoi = useCallback((poiId) => {
        setPois(prev => prev.filter(p => p.id !== poiId));
        setSelectedPoiMenu(null);
    }, []);

    const handleRenamePoi = useCallback((poiId, newLabel) => {
        setPois(prev => prev.map(p =>
            p.id === poiId ? { ...p, label: newLabel } : p
        ));
        setShowRename(null);
        setSelectedPoiMenu(null);
    }, []);

    const handleLinkMap = useCallback((poiId, mapName) => {
        setPois(prev => prev.map(p =>
            p.id === poiId ? { ...p, linkedMap: mapName } : p
        ));
        setSelectedPoiMenu(null);
    }, []);

    const handleUnlinkMap = useCallback((poiId) => {
        setPois(prev => prev.map(p =>
            p.id === poiId ? { ...p, linkedMap: undefined } : p
        ));
        setSelectedPoiMenu(null);
    }, []);

    const handlePoiEnter = useCallback((poi) => {
        if (poi.linkedMap && validLinkedMapsRef.current.has(poi.linkedMap) && onPoiEntered) {
            onPoiEntered(poi.linkedMap);
        }
    }, [onPoiEntered]);

    // ─── Hex hover tracking ─────────────────────────────────────────────

    const handleHexHover = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;
        const snapped = pixelToHexSnapped(svgX, svgY, HEX_SIZE);
        // Clamp to grid bounds
        if (snapped.q >= 0 && snapped.q < gridSize && snapped.r >= 0 && snapped.r < gridSize) {
            setHoveredHex(snapped);
        } else {
            setHoveredHex(null);
        }
    }, [gridSize]);

    // ─── Load / initialize map data on mount ────────────────────────────

    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

        const loadMap = async () => {
            try {
                const existing = await mapsService.loadMapData(campaignName, mapName);
                if (existing) {
                    // Load path — existing map data found
                    const loadedTerrain = existing.terrain || {};
                    const loadedRivers = existing.rivers || [];
                    const loadedPois = existing.pois || [];
                    const loadedGridSize = existing.gridSize || DEFAULT_GRID_SIZE;
                    const loadedZoom = existing.zoom != null ? existing.zoom : 1;
                    // Migrate old broken default (panX=0, panY=0) to centering values
                    const isOldDefault = existing.panX === 0 && existing.panY === 0;
                    const loadedPanX = (!isOldDefault && existing.panX != null) ? existing.panX : -(HEX_SIZE * Math.sqrt(3) / 2);
                    const loadedPanY = (!isOldDefault && existing.panY != null) ? existing.panY : -HEX_SIZE;

                    // Set default type for backward compat
                    if (!existing.type) {
                        existing.type = 'outdoor';
                    }

                    setMapData(existing);
                    setGridSize(loadedGridSize);
                    setTerrain(loadedTerrain);
                    setRivers(loadedRivers);
                    setPois(loadedPois);
                    setZoom(loadedZoom);
                    setPanX(loadedPanX);
                    setPanY(loadedPanY);

                    // Initialize marching order from characters if empty
                    const loadOrder = existing.marchingOrder ||
                        (characters.length > 0 ? characters.map(c => c.name) : []);
                    setMarchingOrder(loadOrder);

                    // Auto-place party at map center if no saved position
                    if (existing.partyPosition) {
                        setPartyPosition(existing.partyPosition);
                    } else {
                        const center = Math.floor(loadedGridSize / 2);
                        setPartyPosition({ q: center, r: center });
                    }

                    hasLoaded.current = true;
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.log('Hex map data not found, initializing new map', err);
            }

            // Create new empty map
            const initialTerrain = {};
            for (let r = 0; r < DEFAULT_GRID_SIZE; r++) {
                for (let q = 0; q < DEFAULT_GRID_SIZE; q++) {
                    initialTerrain[hexKey(q, r)] = DEFAULT_TERRAIN;
                }
            }

            const initialOrder = characters.length > 0 ? characters.map(c => c.name) : [];
            const initialPartyPos = initialOrder.length > 0
                ? { q: Math.floor(DEFAULT_GRID_SIZE / 2), r: Math.floor(DEFAULT_GRID_SIZE / 2) }
                : null;

            const newData = {
                type: 'outdoor',
                gridSize: DEFAULT_GRID_SIZE,
                terrain: initialTerrain,
                pois: [],
                zoom: 1,
                panX: -(HEX_SIZE * Math.sqrt(3) / 2),
                panY: -HEX_SIZE,
                marchingOrder: initialOrder,
                partyPosition: initialPartyPos
            };

            setMapData(newData);
            setTerrain(initialTerrain);
            setGridSize(DEFAULT_GRID_SIZE);
            setMarchingOrder(initialOrder);
            setPartyPosition(initialPartyPos);

            // Save the new map data
            try {
                await mapsService.saveMapData(campaignName, mapName, newData);
            } catch (err) {
                console.error('Failed to save initial hex map data:', err);
            }

            hasLoaded.current = true;
            setLoading(false);
        };

        loadMap();
    }, [campaignName, mapName]);

    // ─── Auto-save when data changes ────────────────────────────────────
    // Guard: only save for the mapName this HexMap was initialized with.
    // Prevents overwriting encounter map files during the brief window
    // when mapName changes (via onEncounterCreated) before Map.jsx switches.

    const hexMapNameRef = useRef(mapName);

    useEffect(() => {
        if (!hasLoaded.current) return;
        if (mapName !== hexMapNameRef.current) return;

        const dataToSave = {
            type: 'outdoor',
            gridSize,
            terrain,
            rivers,
            pois,
            zoom,
            panX,
            panY,
            marchingOrder,
            partyPosition
        };
        mapsService.saveMapData(campaignName, mapName, dataToSave)
            .catch(err => console.error('Failed to save hex map data:', err));
    }, [campaignName, mapName, terrain, rivers, pois, gridSize, zoom, panX, panY, marchingOrder, partyPosition]);

    const viewPortBounds = useMemo(() => ({
        left: panX,
        top: panY,
        right: panX + svgWidth / zoom,
        bottom: panY + svgHeight / zoom,
    }), [panX, panY, svgWidth, svgHeight, zoom]);

    // ─── Sync state to refs for use in event handlers ──────────────────

    useEffect(() => { zoomValueRef.current = zoom; }, [zoom]);
    useEffect(() => { panXValueRef.current = panX; }, [panX]);
    useEffect(() => { panYValueRef.current = panY; }, [panY]);

    // ─── Render ─────────────────────────────────────────────────────────

    return (
        <div className="hex-map">
            <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />
            <HexMapToolbar
                onBack={onBack}
                mapName={mapsService.formatMapName(mapName)}
                tool={tool}
                setTool={setTool}
                selectedTerrain={selectedTerrain}
                setSelectedTerrain={setSelectedTerrain}
                terrainTypes={TERRAIN_TYPES}
                zoomIn={zoomIn}
                zoomOut={zoomOut}
                resetView={resetView}
                zoom={zoom}
                poiPanelOpen={poiPanelOpen}
                setPoiPanelOpen={setPoiPanelOpen}
                gridSize={gridSize}
                setGridSize={setGridSize}
                marchingOrderOpen={marchingOpen}
                setMarchingOrderOpen={setMarchingOpen}
                marchingOrder={marchingOrder}
                onGenerateRivers={handleGenerateRivers}
            />

            {loading ? (
                <div className="hex-map-loading">Loading map...</div>
            ) : (
                <div className="hex-map-canvas">
                    <svg
                        ref={svgRef}
                        viewBox={`${panX} ${panY} ${svgWidth / zoom} ${svgHeight / zoom}`}
                        className="hex-svg"
                        onPointerDown={(e) => {
                            if (tool === TOOL_PAINT || tool === TOOL_ERASE) {
                                handleTerrainPointerDown(e);
                            } else {
                                handlePanStart(e);
                            }
                        }}
                        onPointerMove={(e) => {
                            handlePanMove(e);
                            handleTerrainPointerMove(e);
                            handlePoiPointerMove(e);
                            handleHexHover(e);
                        }}
                        onPointerUp={(e) => {
                            handlePanEnd(e);
                            handleTerrainPointerUp(e);
                            handlePoiPointerUp(e);
                        }}
                        onPointerLeave={() => {
                            handlePanEnd();
                            handleTerrainPointerUp();
                            handlePoiPointerUp();
                            setHoveredHex(null);
                        }}
                        onWheel={handleWheel}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={(e) => {
                            setSelectedPoiMenu(null);
                            setShowRename(null);
                            setPartyContextMenu(null);
                            if (tool === TOOL_TRAVEL && partyPosition) {
                                const hex = getHexFromEvent(e);
                                if (!hex) return;
                                if (hex.q < 0 || hex.q >= gridSize || hex.r < 0 || hex.r >= gridSize) return;
                                if (hex.q === partyPosition.q && hex.r === partyPosition.r) return;
                                if (!travelMgmt.isTravelActive || travelMgmt.travelMode === travelMgmt.MODES.INACTIVE) {
                                    travelMgmt.startPlanning();
                                }
                                travelMgmt.setDestinationAndPath(hex);
                            }
                        }}
                        style={{
                            cursor: panning
                                ? 'grabbing'
                                : (tool === TOOL_PAN || tool === TOOL_NONE ? 'grab' : 'crosshair')
                        }}
                    >
                        <defs>
                            <SettlementSVG id="poi-settlement" />
                            <DungeonSVG id="poi-dungeon" />
                            <CampSVG id="poi-camp" />
                            <TowerSVG id="poi-tower" />
                            <LoreSiteSVG id="poi-loreSite" />
                            <HazardSVG id="poi-hazard" />
                            <NaturalWonderSVG id="poi-naturalWonder" />
                            <LandmarkSVG id="poi-landmark" />
                        </defs>

                        <TerrainLayer
                            gridSize={gridSize}
                            terrain={terrain}
                        />
                        <RiverLayer
                            rivers={rivers}
                            gridSize={gridSize}
                        />
                        <HexGridLayer
                            gridSize={gridSize}
                        />
                        <POILayer
                            pois={pois}
                            onPoiPointerDown={handlePoiPointerDown}
                            onPoiContextMenu={handlePoiContextMenu}
                            poiDragging={poiDragging}
                            poiHover={null}
                            isLocalhost={isLocalhost}
                            partyPosition={partyPosition}
                            onPoiEnter={handlePoiEnter}
                            validLinkedMaps={validLinkedMaps}
                        />
                        <PartyMarkerLayer
                            position={partyPosition}
                            HEX_SIZE={HEX_SIZE}
                            gridSize={gridSize}
                            onPositionChange={setPartyPosition}
                            svgRef={svgRef}
                            onEncounter={handleStartEncounter}
                            contextMenuOpen={partyContextMenu !== null && partyContextMenu.q === (partyPosition?.q) && partyContextMenu.r === (partyPosition?.r)}
                            onContextMenu={(q, r) => setPartyContextMenu({ q, r })}
                            travelMode={travelMgmt.travelMode}
                            onAdvance={travelMgmt.advanceOneHex}
                            onCancelTravel={travelMgmt.cancelTravel}
                        />

                        <TravelPathLayer
                            path={travelMgmt.path}
                            pathIndex={travelMgmt.pathIndex}
                            partyPosition={partyPosition}
                        />

                    {/* Hovered hex highlight (only when paint/erase active) */}
                    {hoveredHex && (tool === TOOL_PAINT || tool === TOOL_ERASE) && (() => {
                        const center = hexToPixel(hoveredHex.q, hoveredHex.r, HEX_SIZE);
                        const pathD = hexToSVGPath(center.x, center.y, HEX_SIZE);
                        return (
                            <path
                                d={pathD}
                                fill="rgba(255,255,255,0.15)"
                                stroke="#FFD700"
                                strokeWidth={1.5}
                                pointerEvents="none"
                            />
                        );
                    })()}

                    {/* River hover highlight */}
                    {hoveredHex && tool === TOOL_RIVER && (() => {
                        const center = hexToPixel(hoveredHex.q, hoveredHex.r, HEX_SIZE);
                        const pathD = hexToSVGPath(center.x, center.y, HEX_SIZE);
                        const key = hexKey(hoveredHex.q, hoveredHex.r);
                        const hasRiver = rivers.includes(key);
                        return (
                            <path
                                d={pathD}
                                fill={hasRiver ? 'rgba(200,50,50,0.15)' : 'rgba(60,130,210,0.2)'}
                                stroke={hasRiver ? '#c44' : '#4A90D9'}
                                strokeWidth={1.5}
                                pointerEvents="none"
                            />
                        );
                    })()}

                        {/* Context menu for POIs */}
                        <POIContextMenu
                            selectedPoi={selectedPoiMenu}
                            pois={pois}
                            showRename={showRename}
                            onToggleVisibility={handleTogglePoiVisibility}
                            onDelete={handleDeletePoi}
                            onRename={handleRenamePoi}
                            onLinkMap={handleLinkMap}
                            onUnlinkMap={handleUnlinkMap}
                            onClose={() => { setSelectedPoiMenu(null); setShowRename(null); }}
                            setShowRename={setShowRename}
                            indoorMaps={indoorMaps}
                            viewPortBounds={viewPortBounds}
                        />
                    </svg>

                    <div className="hex-map-compass">
                        <svg viewBox="0 0 48 48" width="44" height="44">
                            <polygon points="24,2 28,20 46,24 28,28 24,46 20,28 2,24 20,20" fill="#666" stroke="#999" strokeWidth="0.5" />
                            <polygon points="24,2 28,20 24,24 20,20" fill="#c44" />
                            <polygon points="24,46 28,28 24,24 20,28" fill="#555" />
                            <text x="24" y="15" textAnchor="middle" fill="#c44" fontSize="6" fontWeight="bold">N</text>
                        </svg>
                    </div>
                </div>
            )}

            {/* Marching Order Panel overlay */}
            {marchingOpen && (
                <MarchingOrderPanel
                    marchingOrder={marchingOrder}
                    setMarchingOrder={setMarchingOrder}
                    characters={characters}
                    onClose={() => setMarchingOpen(false)}
                />
            )}

            {/* POI Panel overlay */}
            {poiPanelOpen && (
                <POIPanel
                    poiPanelOpen={poiPanelOpen}
                    onClose={() => setPoiPanelOpen(false)}
                    characters={characters}
                />
            )}

            {/* Travel Panel overlay */}
            <TravelPanel
                travelMode={travelMgmt.travelMode}
                travelPace={travelMgmt.travelPace}
                destination={travelMgmt.destination}
                path={travelMgmt.path}
                pathIndex={travelMgmt.pathIndex}
                accruedCost={travelMgmt.accruedCost}
                dailyBudget={travelMgmt.dailyBudget}
                dayExhausted={travelMgmt.dayExhausted}
                lastMessage={travelMgmt.lastMessage}
                paceInfo={travelMgmt.paceInfo}
                hexesRemaining={travelMgmt.hexesRemaining}
                isTravelActive={travelMgmt.isTravelActive}
                terrain={terrain}
                onChangePace={travelMgmt.changePace}
                onAdvance={travelMgmt.advanceOneHex}
                onCancel={travelMgmt.cancelTravel}
                onForceCamp={travelMgmt.forceCamp}
                onForcedMarch={travelMgmt.forcedMarch}
            />
        </div>
    );
}

export default HexMap;
