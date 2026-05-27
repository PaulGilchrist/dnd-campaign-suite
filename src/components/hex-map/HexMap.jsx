import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import * as mapsService from '../../services/mapsService.js';
import {
    HEX_SIZE, DEFAULT_GRID_SIZE, GRID_COLS_MULTIPLIER, DEFAULT_TERRAIN, MIN_ZOOM, MAX_ZOOM,
    TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_RIVER, TOOL_PAN, TOOL_TRAVEL, TOOL_ROAD,
    TERRAIN_TYPES, POI_TYPES
} from '../../config/outdoorConfig.js';
import { generateWeather } from '../../services/weatherService.js';
import { hexKey, hexToPixel, pixelToHexSnapped, hexToSVGPath, isRoadConnectable, findHexPath } from '../../services/hexMapUtils.js';
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
import RoadLayer from './RoadLayer.jsx';
import SettlementSVG from './svg/SettlementSVG.jsx';
import CitySVG from './svg/CitySVG.jsx';
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
import { useMonstersData } from '../../hooks/useMonstersData.js';
import TravelPanel from './TravelPanel.jsx';
import TravelPathLayer from './TravelPathLayer.jsx';
import useLog from '../../hooks/useLog.js';
import WeatherOverlay from './WeatherOverlay.jsx';
import EventDialog from './EventDialog.jsx';
import './HexMap.css';

function HexMap({ campaignName, mapName, onBack, characters = [], onEncounterCreated, isLocalhost = false, onPoiEntered }) {
    const [loading, setLoading] = useState(true);
    const [, setMapData] = useState(null);       // full map data object from server
    const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
    const hexCols = gridSize * GRID_COLS_MULTIPLIER;
    const hexRows = gridSize;
    const [terrain, setTerrain] = useState({});          // Record<hexKey, terrainType>
    const [rivers, setRivers] = useState([]);            // array of "q,r" strings
    const [pois, setPois] = useState([]);                // array of POI objects
    const [roads, setRoads] = useState([]);              // array of road objects { id, fromPoiId, toPoiId, hexes }
    const [roadStartPoiId, setRoadStartPoiId] = useState(null); // POI id selected as road start

    // Marching order state
    const [marchingOrder, setMarchingOrder] = useState([]);  // ordered character names
    const [partyPosition, setPartyPosition] = useState(null); // {hexQ, hexR} | null
    const [marchingOpen, setMarchingOpen] = useState(false);  // panel toggle

    // Travel state
    const [weather, setWeather] = useState(null);
    const { monsters } = useMonstersData();
    const playerLevels = React.useMemo(
        () => characters.map(c => c.level || 1),
        [characters]
    );

    const { addEntry } = useLog(campaignName);

    const travelMgmt = useTravelManagement({
        hexCols,
        hexRows,
        terrain,
        partyPosition,
        onPartyMove: setPartyPosition,
        weather,
        monsters,
        playerLevels,
        roads,
    });

    const handleGenerateWeather = useCallback(() => {
        const terrainKey = partyPosition ? hexKey(partyPosition.q, partyPosition.r) : null;
        const currentTerrain = terrainKey ? terrain[terrainKey] || 'plains' : 'plains';
        setWeather(generateWeather(currentTerrain));
    }, [partyPosition, terrain]);

    const logTravel = useCallback((action, hex, tileTerrain, w, evt) => {
        addEntry({
            type: 'travel',
            action,
            hex: hex || null,
            terrain: tileTerrain || null,
            weather: w?.label || null,
            weatherIcon: w?.icon || null,
            eventType: evt?.type || null,
            eventTitle: evt?.title || null,
        });
    }, [addEntry]);

    const handleForceCamp = useCallback(() => {
        travelMgmt.forceCamp();
        handleGenerateWeather();
        const pos = travelMgmt.currentPosition || partyPosition;
        logTravel('camp', pos, null, weather);
    }, [travelMgmt, handleGenerateWeather, partyPosition, weather, logTravel]);

    const handleReRollWeather = useCallback(() => {
        handleGenerateWeather();
        if (travelMgmt.isTravelActive) {
            travelMgmt.changePace(travelMgmt.travelPace);
        }
    }, [handleGenerateWeather, travelMgmt]);

    const handleAdvance = useCallback(() => {
        const nextIdx = travelMgmt.pathIndex + 1;
        const nextHex = travelMgmt.path[nextIdx];
        const result = travelMgmt.advanceOneHex();

        if (result.moved) {
            const terrainKey = nextHex ? hexKey(nextHex.q, nextHex.r) : null;
            const tileTerrain = terrainKey ? terrain[terrainKey] || 'plains' : null;
            const action = result.event ? 'advance_with_event' : (result.arrived ? 'arrived' : 'advance');
            logTravel(action, nextHex, tileTerrain, weather, result.event);
        } else if (travelMgmt.dayExhausted) {
            logTravel('day_exhausted', null, null, weather);
        } else if (weather?.moveCostMod === null) {
            logTravel('extreme_weather', null, null, weather);
        }

        return result;
    }, [travelMgmt, weather, terrain, logTravel]);

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

    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [panning, setPanning] = useState(null);        // { startX, startY, startPanX, startPanY } | null
    const [hoveredHex, setHoveredHex] = useState(null);  // { q, r } | null
    const [partyContextMenu, setPartyContextMenu] = useState(null); // { q, r } | null

    const svgRef = useRef(null);
    const zoomValueRef = useRef(MIN_ZOOM);
    const panXValueRef = useRef(0);
    const panYValueRef = useRef(0);
    const accumulatedDeltaRef = useRef(0);
    const isInitialized = useRef(false);
    const hasLoaded = useRef(false);
    const needsResetViewRef = useRef(false);
    const toolInitRef = useRef(true);

    // Sync tool ↔ travel management state
    const prevToolRef = useRef(TOOL_NONE);
    useEffect(() => {
        if (toolInitRef.current) {
            toolInitRef.current = false;
            prevToolRef.current = tool;
            return;
        }
        const toolJustActivated = tool === TOOL_TRAVEL && prevToolRef.current !== TOOL_TRAVEL;
        prevToolRef.current = tool;

        if (toolJustActivated && travelMgmt.travelMode === 'inactive') {
            travelMgmt.startPlanning();
            if (!weather) {
                handleGenerateWeather();
            }
        } else if (travelMgmt.travelMode === 'inactive' && tool === TOOL_TRAVEL) {
            setTool(TOOL_NONE);
        } else if (tool !== TOOL_TRAVEL && travelMgmt.isTravelActive) {
            travelMgmt.cancelTravel();
        }
    }, [tool, weather, handleGenerateWeather, travelMgmt]);

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
        campaignName, mapName, setGridSize, setTerrain, setRivers, setRoads, setPois,
        setZoom, setPanX, setPanY, setMarchingOrder, setPartyPosition, setMapData,
        setWeather,
    });

    // Computed SVG dimensions — corrected to account for full axial extent + hex shape
    const gridPixelBounds = useMemo(() => {
        const xMin = -HEX_SIZE * Math.sqrt(3) / 2;
        const xMax = HEX_SIZE * Math.sqrt(3) * ((hexCols - 1) + (hexRows - 1) / 2 + 0.5);
        const yMin = -HEX_SIZE;
        const yMax = HEX_SIZE * (1.5 * (hexRows - 1) + 1);
        return {
            width: xMax - xMin,
            height: yMax - yMin,
            offsetX: xMin,
            offsetY: yMin,
            centerX: (xMin + xMax) / 2,
            centerY: (yMin + yMax) / 2,
        };
    }, [hexCols, hexRows]);

    const svgWidth = gridPixelBounds.width;
    const svgHeight = gridPixelBounds.height;

    // ── TUNING: MARGIN_X / MARGIN_Y — hex-widths to inset from each grid edge ──
    // These formulas exactly hide empty diagonal corners for any grid size.
    // For 60×30: MARGIN_X=14.5, MARGIN_Y=6.5 (dialed in manually).
    const MARGIN_X = (hexRows - 1) / 2 || 0.5;
    const MARGIN_Y = hexRows / 4 - 1 || 0.5;

    // Uncomment to override with manual values:
    // const MARGIN_X = 14.5;
    // const MARGIN_Y = 6.5;

    const clampPan = useCallback((pz, px, py) => {
        const viewW = gridPixelBounds.width / pz;
        const viewH = gridPixelBounds.height / pz;
        const sqrt3 = Math.sqrt(3);
        const hexW = sqrt3 * HEX_SIZE; // one hex width in pixels
        const hexH = 1.5 * HEX_SIZE;   // one hex height in pixels
        const marginX = MARGIN_X * hexW;
        const marginY = MARGIN_Y * hexH;

        // Grid pixel bounds (outer edges of outermost hexes)
        const gridLeft = gridPixelBounds.offsetX + marginX;
        const gridRight = gridPixelBounds.offsetX + gridPixelBounds.width - marginX;
        const gridTop = gridPixelBounds.offsetY + marginY;
        const gridBottom = gridPixelBounds.offsetY + gridPixelBounds.height - marginY;

        const minPanX = gridLeft;
        const maxPanX = gridRight - viewW;
        const minPanY = gridTop;
        const maxPanY = gridBottom - viewH;

        return {
            x: Math.min(maxPanX, Math.max(minPanX, px)),
            y: Math.min(maxPanY, Math.max(minPanY, py)),
        };
    }, [gridPixelBounds, MARGIN_X, MARGIN_Y]);

    useLayoutEffect(() => {
        if (needsResetViewRef.current) {
            needsResetViewRef.current = false;
            const vw = gridPixelBounds.width / 2;
            const vh = gridPixelBounds.height / 2;
            const cx = gridPixelBounds.centerX - vw / 2;
            const cy = gridPixelBounds.centerY - vh / 2;
            const clamped = clampPan(2, cx, cy);
            setZoom(2);
            setPanX(clamped.x);
            setPanY(clamped.y);
            return;
        }
        const clamped = clampPan(zoom, panXValueRef.current, panYValueRef.current);
        if (clamped.x !== panXValueRef.current) {
            panXValueRef.current = clamped.x;
            setPanX(clamped.x);
        }
        if (clamped.y !== panYValueRef.current) {
            panYValueRef.current = clamped.y;
            setPanY(clamped.y);
        }
    }, [zoom, gridSize, clampPan, gridPixelBounds]);

    // ─── Zoom/Pan helpers ────────────────────────────────────────────────

    const zoomIn = useCallback(() => {
        setZoom(prev => {
            const next = Math.min(MAX_ZOOM, prev * 1.25);
            const vw = gridPixelBounds.width / next;
            const vh = gridPixelBounds.height / next;
            const cx = gridPixelBounds.centerX - vw / 2;
            const cy = gridPixelBounds.centerY - vh / 2;
            const clamped = clampPan(next, cx, cy);
            setPanX(clamped.x);
            setPanY(clamped.y);
            return next;
        });
    }, [gridPixelBounds, clampPan]);

    const zoomOut = useCallback(() => {
        setZoom(prev => {
            const next = Math.max(MIN_ZOOM, prev * 0.8);
            const vw = gridPixelBounds.width / next;
            const vh = gridPixelBounds.height / next;
            const cx = gridPixelBounds.centerX - vw / 2;
            const cy = gridPixelBounds.centerY - vh / 2;
            const clamped = clampPan(next, cx, cy);
            setPanX(clamped.x);
            setPanY(clamped.y);
            return next;
        });
    }, [gridPixelBounds, clampPan]);

    const resetView = useCallback(() => {
        const vw = gridPixelBounds.width / 2;
        const vh = gridPixelBounds.height / 2;
        const cx = gridPixelBounds.centerX - vw / 2;
        const cy = gridPixelBounds.centerY - vh / 2;
        const clamped = clampPan(2, cx, cy);
        setZoom(2);
        setPanX(clamped.x);
        setPanY(clamped.y);
    }, [gridPixelBounds, clampPan]);

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
        const clamped = clampPan(zoomValueRef.current, panning.startPanX - dx, panning.startPanY - dy);
        setPanX(clamped.x);
        setPanY(clamped.y);
    }, [panning, clampPan]);

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
        const clamped = clampPan(newZoom, newPanX, newPanY);
        setZoom(newZoom);
        setPanX(clamped.x);
        setPanY(clamped.y);
    }, [clampPan]);

    // ─── Hex coordinate helpers ─────────────────────────────────────────

    const getHexFromEvent = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg) return null;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        return pixelToHexSnapped(svgP.x, svgP.y, HEX_SIZE);
    }, []);

    // ─── Terrain painting handlers ──────────────────────────────────────

    const handleTerrainPointerDown = useCallback((e) => {
        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= hexCols || hex.r < 0 || hex.r >= hexRows) return;
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
    }, [tool, selectedTerrain, getHexFromEvent, hexCols, hexRows]);

    const handleTerrainPointerMove = useCallback((e) => {
        if (!paintingRef.current) return;
        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= hexCols || hex.r < 0 || hex.r >= hexRows) return;
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
    }, [tool, selectedTerrain, getHexFromEvent, hexCols, hexRows]);

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
        if (hex.q < 0 || hex.q >= hexCols || hex.r < 0 || hex.r >= hexRows) return;

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
    }, [pois, getHexFromEvent, hexCols, hexRows]);

    // ─── POI interaction handlers ──────────────────────────────────────

    const handlePoiPointerDown = useCallback((poiId, e) => {
        e.preventDefault();
        e.stopPropagation();

        if (tool === TOOL_ROAD) {
            const poi = pois.find(p => p.id === poiId);
            if (!poi) return;
            if (!isRoadConnectable(poi.type, poi.type)) {
                setRoadStartPoiId(null);
                return;
            }

                if (roadStartPoiId === null) {
                setRoadStartPoiId(poiId);
            } else if (roadStartPoiId === poiId) {
                setRoadStartPoiId(null);
            } else {
                const fromPoi = pois.find(p => p.id === roadStartPoiId);
                const toPoi = poi;
                if (!fromPoi || !toPoi) { setRoadStartPoiId(null); return; }

                const exists = roads.some(r =>
                    (r.fromPoiId === roadStartPoiId && r.toPoiId === poiId) ||
                    (r.toPoiId === roadStartPoiId && r.fromPoiId === poiId)
                );
                if (exists) {
                    setRoads(prev => prev.filter(r =>
                        !((r.fromPoiId === roadStartPoiId && r.toPoiId === poiId) ||
                          (r.toPoiId === roadStartPoiId && r.fromPoiId === poiId))
                    ));
                    setRoadStartPoiId(null);
                    return;
                }

                const path = findHexPath(fromPoi, toPoi, hexCols, hexRows, terrain);
                if (path) {
                    const newRoad = {
                        id: `road-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                        fromPoiId: roadStartPoiId,
                        toPoiId: poiId,
                        hexes: path.map(h => `${h.q},${h.r}`),
                    };
                    setRoads(prev => [...prev, newRoad]);
                }
                setRoadStartPoiId(null);
            }
            return;
        }

        const poi = pois.find(p => p.id === poiId);
        if (!poi) return;
        setPoiDragging({ poiId, startQ: poi.q, startR: poi.r });
    }, [pois, tool, roadStartPoiId, roads, terrain, hexCols, hexRows]);

    const handlePoiPointerMove = useCallback((e) => {
        if (!poiDragging) return;
        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= hexCols || hex.r < 0 || hex.r >= hexRows) return;

        // Check no other POI at target hex
        const exists = pois.some(p => p.id !== poiDragging.poiId && p.q === hex.q && p.r === hex.r);
        if (exists) return;

        setPois(prev => prev.map(p =>
            p.id === poiDragging.poiId ? { ...p, q: hex.q, r: hex.r } : p
        ));
    }, [poiDragging, pois, getHexFromEvent, hexCols, hexRows]);

    const handlePoiPointerUp = useCallback(() => {
        if (poiDragging) {
            const draggedId = poiDragging.poiId;
            // Recalculate roads connected to the moved POI
            setRoads(prev => prev.map(road => {
                if (road.fromPoiId === draggedId || road.toPoiId === draggedId) {
                    const otherPoiId = road.fromPoiId === draggedId ? road.toPoiId : road.fromPoiId;
                    const movedPoi = pois.find(p => p.id === draggedId);
                    const otherPoi = pois.find(p => p.id === otherPoiId);
                    if (movedPoi && otherPoi) {
                        const path = findHexPath(movedPoi, otherPoi, hexCols, hexRows, terrain);
                        if (path) {
                            return { ...road, hexes: path.map(h => `${h.q},${h.r}`) };
                        }
                    }
                }
                return road;
            }));
        }
        setPoiDragging(null);
    }, [poiDragging, pois, terrain, hexCols, hexRows]);

    const handleStartEncounter = useCallback(async (q, r, extraPlacedItems = []) => {
        const terrainType = terrain[hexKey(q, r)] || 'plains';
        const grid = 30;
        const encounterData = generateOutdoorEncounter(terrainType, grid, marchingOrder, q, r);
        const baseMapName = mapName.replace(/\.json$/, '');
        const encounterName = `${baseMapName} - Encounter at ${q},${r}`;

        // Merge extra items (monsters) into placed items
        if (extraPlacedItems.length > 0) {
            encounterData.placedItems = [...encounterData.placedItems, ...extraPlacedItems];
        }

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

    function generateMonsterPlacements(monsters, gridSize) {
        const center = Math.floor(gridSize / 2);
        const items = [];
        let idCounter = 0;
        const occupied = new Set();

        for (const group of monsters) {
            for (let i = 0; i < group.qty; i++) {
                let attempts = 0;
                let gx, gy, key;
                do {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 6 + Math.random() * 6;
                    gx = Math.round(center + Math.cos(angle) * distance);
                    gy = Math.round(center + Math.sin(angle) * distance);
                    gx = Math.max(1, Math.min(gridSize - 2, gx));
                    gy = Math.max(1, Math.min(gridSize - 2, gy));
                    key = `${gx},${gy}`;
                    attempts++;
                } while (occupied.has(key) && attempts < 20);

                occupied.add(key);
                items.push({
                    id: `enc-monster-${idCounter++}`,
                    type: 'npc',
                    name: group.name,
                    gridX: gx,
                    gridY: gy,
                    visible: true,
                });
            }
        }

        return items;
    }

    const handleEventAccept = useCallback(() => {
        const evt = travelMgmt.acceptEvent();
        const pos = travelMgmt.currentPosition || partyPosition;
        if (evt?.type === 'combat') {
            if (pos && evt.encounter?.monsters) {
                const grid = 30;
                const monsterItems = generateMonsterPlacements(evt.encounter.monsters, grid);
                handleStartEncounter(pos.q, pos.r, monsterItems);
            } else if (pos) {
                handleStartEncounter(pos.q, pos.r);
            }
        }
        if (evt?.type === 'weatherChange') {
            handleGenerateWeather();
            if (travelMgmt.isTravelActive) {
                travelMgmt.changePace(travelMgmt.travelPace);
            }
        }
        const terrainKey = pos ? hexKey(pos.q, pos.r) : null;
        const tileTerrain = terrainKey ? terrain[terrainKey] || 'plains' : null;
        logTravel('event_accept', pos, tileTerrain, weather, evt);
    }, [travelMgmt, partyPosition, handleStartEncounter, handleGenerateWeather, terrain, weather, logTravel]);

    const handleEventSkip = useCallback(() => {
        const evt = travelMgmt.pendingEvent;
        travelMgmt.skipEvent();
        const pos = travelMgmt.currentPosition || partyPosition;
        logTravel('event_skip', pos, null, weather, evt);
    }, [travelMgmt, partyPosition, weather, logTravel]);

    const handleEventReroll = useCallback(() => {
        const evt = travelMgmt.pendingEvent;
        travelMgmt.rerollEvent();
        const pos = travelMgmt.currentPosition || partyPosition;
        logTravel('event_reroll', pos, null, weather, evt);
    }, [travelMgmt, partyPosition, weather, logTravel]);

    const handleForcedMarch = useCallback(() => {
        travelMgmt.forcedMarch();
        const pos = travelMgmt.currentPosition || partyPosition;
        logTravel('forced_march', pos, null, weather);
    }, [travelMgmt, partyPosition, weather, logTravel]);

    const handlePoiContextMenu = useCallback((poiId) => {
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
        setRoads(prev => prev.filter(r => r.fromPoiId !== poiId && r.toPoiId !== poiId));
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

    const handleRemoveRoads = useCallback((poiId) => {
        setRoads(prev => prev.filter(r => r.fromPoiId !== poiId && r.toPoiId !== poiId));
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
        if (snapped.q >= 0 && snapped.q < hexCols && snapped.r >= 0 && snapped.r < hexRows) {
            setHoveredHex(snapped);
        } else {
            setHoveredHex(null);
        }
    }, [hexCols, hexRows]);

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
                    const loadedRoads = existing.roads || [];
                    const loadedPois = existing.pois || [];
                    const loadedGridSize = existing.gridSize || DEFAULT_GRID_SIZE;
                    const loadedZoom = existing.zoom != null ? Math.max(MIN_ZOOM, existing.zoom) : MIN_ZOOM;
                    // Migrate old broken default (panX=0, panY=0) to centering values
                    const isOldDefault = existing.panX === 0 && existing.panY === 0;
                    const loadedPanX = (!isOldDefault && existing.panX != null) ? existing.panX : 0;
                    const loadedPanY = (!isOldDefault && existing.panY != null) ? existing.panY : 0;

                    // Set default type for backward compat
                    if (!existing.type) {
                        existing.type = 'outdoor';
                    }

                    setMapData(existing);
                    setGridSize(loadedGridSize);
                    setTerrain(loadedTerrain);
                    setRivers(loadedRivers);
                    setRoads(loadedRoads);
                    setPois(loadedPois);
                    setZoom(loadedZoom);
                    setPanX(loadedPanX);
                    setPanY(loadedPanY);
                    panXValueRef.current = loadedPanX;
                    panYValueRef.current = loadedPanY;
                    if (existing.weather) setWeather(existing.weather);

                    // If pan was never set (old default 0,0), reset view to center
                    if (isOldDefault) {
                        needsResetViewRef.current = true;
                    }

                    // Initialize marching order from characters if empty
                    const loadOrder = existing.marchingOrder ||
                        (characters.length > 0 ? characters.map(c => c.name) : []);
                    setMarchingOrder(loadOrder);

                    // Auto-place party at map center if no saved position
                    if (existing.partyPosition) {
                        setPartyPosition(existing.partyPosition);
                    } else {
                        const centerCols = loadedGridSize * GRID_COLS_MULTIPLIER;
                        setPartyPosition({ q: Math.floor(centerCols / 2), r: Math.floor(loadedGridSize / 2) });
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
                partyPosition: initialPartyPos
            };

            setMapData(newData);
            setTerrain(initialTerrain);
            setGridSize(DEFAULT_GRID_SIZE);
            setMarchingOrder(initialOrder);
            setPartyPosition(initialPartyPos);
            setZoom(MIN_ZOOM);
            setPanX(0);
            setPanY(0);
            panXValueRef.current = 0;
            panYValueRef.current = 0;
            needsResetViewRef.current = true;

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
    }, [campaignName, mapName, characters]);

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
            roads,
            pois,
            zoom,
            panX,
            panY,
            marchingOrder,
            partyPosition,
            weather,
        };
        mapsService.saveMapData(campaignName, mapName, dataToSave)
            .catch(err => console.error('Failed to save hex map data:', err));
    }, [campaignName, mapName, terrain, rivers, roads, pois, gridSize, zoom, panX, panY, marchingOrder, partyPosition, weather]);

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
            />

            {loading ? (
                <div className="hex-map-loading">Loading map...</div>
            ) : (
                <div className="hex-map-canvas">
                    <svg
                        ref={svgRef}
                        viewBox={`${panX} ${panY} ${svgWidth / zoom} ${svgHeight / zoom}`}
                        className="hex-svg"
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        onPointerDown={(e) => {
                            if (tool === TOOL_PAINT || tool === TOOL_ERASE || tool === TOOL_RIVER) {
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
                            if (tool === TOOL_ROAD) {
                                setRoadStartPoiId(null);
                            } else if (tool === TOOL_TRAVEL && partyPosition) {
                                const hex = getHexFromEvent(e);
                                if (!hex) return;
                                if (hex.q < 0 || hex.q >= hexCols || hex.r < 0 || hex.r >= hexRows) return;
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
                            <CampSVG id="poi-camp" />
                            <CitySVG id="poi-city" />
                            <DungeonSVG id="poi-dungeon" />
                            <HazardSVG id="poi-hazard" />
                            <LandmarkSVG id="poi-landmark" />
                            <LoreSiteSVG id="poi-loreSite" />
                            <NaturalWonderSVG id="poi-naturalWonder" />
                            <SettlementSVG id="poi-settlement" />
                            <TowerSVG id="poi-tower" />
                        </defs>

                        <TerrainLayer
                            hexCols={hexCols}
                            hexRows={hexRows}
                            terrain={terrain}
                        />
                        <RiverLayer
                            rivers={rivers}
                            hexCols={hexCols}
                            hexRows={hexRows}
                        />
                        <HexGridLayer
                            hexCols={hexCols}
                            hexRows={hexRows}
                        />
                        <RoadLayer
                            roads={roads}
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
                            roadStartPoiId={roadStartPoiId}
                        />
                        <PartyMarkerLayer
                            position={partyPosition}
                            HEX_SIZE={HEX_SIZE}
                            hexCols={hexCols}
                            hexRows={hexRows}
                            onPositionChange={setPartyPosition}
                            svgRef={svgRef}
                            onEncounter={handleStartEncounter}
                            contextMenuOpen={partyContextMenu !== null && partyContextMenu.q === (partyPosition?.q) && partyContextMenu.r === (partyPosition?.r)}
                            onContextMenu={(q, r) => setPartyContextMenu({ q, r })}
                            travelMode={travelMgmt.travelMode}
                            onAdvance={handleAdvance}
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
                            onRemoveRoads={handleRemoveRoads}
                            onClose={() => { setSelectedPoiMenu(null); setShowRename(null); }}
                            setShowRename={setShowRename}
                            indoorMaps={indoorMaps}
                            viewPortBounds={viewPortBounds}
                            roads={roads}
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

                    <WeatherOverlay weather={weather} />
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
                pendingEvent={travelMgmt.pendingEvent}
                terrain={terrain}
                eventFrequency={travelMgmt.eventFrequency}
                onChangePace={travelMgmt.changePace}
                onAdvance={handleAdvance}
                onCancel={travelMgmt.cancelTravel}
                onForceCamp={handleForceCamp}
                onForcedMarch={handleForcedMarch}
                weather={weather}
                onReRollWeather={handleReRollWeather}
                onSetEventFrequency={travelMgmt.setEventFrequency}
                horseback={travelMgmt.horseback}
                onToggleHorseback={travelMgmt.toggleHorseback}
            />

            <EventDialog
                event={travelMgmt.pendingEvent}
                rerollsRemaining={travelMgmt.rerollsRemaining}
                onAccept={handleEventAccept}
                onSkip={handleEventSkip}
                onReroll={handleEventReroll}
            />
        </div>
    );
}

export default HexMap;
