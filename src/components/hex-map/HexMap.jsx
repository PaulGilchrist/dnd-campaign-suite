import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as mapsService from '../../services/mapsService.js';
import {
    HEX_SIZE, DEFAULT_GRID_SIZE, DEFAULT_TERRAIN, MIN_ZOOM, MAX_ZOOM,
    TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_PAN,
    TERRAIN_TYPES, POI_TYPES
} from '../../config/outdoorConfig.js';
import { hexKey, hexToPixel, pixelToHexSnapped, hexToSVGPath } from '../../services/hexMapUtils.js';
import TerrainLayer from './TerrainLayer.jsx';
import HexGridLayer from './HexGridLayer.jsx';
import HexMapToolbar from './HexMapToolbar.jsx';
import POILayer from './POILayer.jsx';
import POIPanel from './POIPanel.jsx';
import POIContextMenu from './POIContextMenu.jsx';
import SettlementSVG from './svg/SettlementSVG.jsx';
import DungeonSVG from './svg/DungeonSVG.jsx';
import CampSVG from './svg/CampSVG.jsx';
import TowerSVG from './svg/TowerSVG.jsx';
import LoreSiteSVG from './svg/LoreSiteSVG.jsx';
import HazardSVG from './svg/HazardSVG.jsx';
import NaturalWonderSVG from './svg/NaturalWonderSVG.jsx';
import LandmarkSVG from './svg/LandmarkSVG.jsx';
import './HexMap.css';

function HexMap({ campaignName, mapName, onBack }) {
    const [loading, setLoading] = useState(true);
    const [mapData, setMapData] = useState(null);       // full map data object from server
    const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE); // hex grid dimensions
    const [terrain, setTerrain] = useState({});          // Record<hexKey, terrainType>
    const [pois, setPois] = useState([]);                // array of POI objects

    // Tool state
    const [tool, setTool] = useState(TOOL_NONE);         // current tool mode
    const [selectedTerrain, setSelectedTerrain] = useState(TERRAIN_TYPES[0].id);
    // POI interaction state
    const [poiPanelOpen, setPoiPanelOpen] = useState(false);
    const [selectedPoiMenu, setSelectedPoiMenu] = useState(null); // { id, q, r }
    const [showRename, setShowRename] = useState(null);
    const [poiDragging, setPoiDragging] = useState(null); // { poiId, startQ, startR } | null

    // Painting state
    const paintingRef = useRef(false); // whether we're in the middle of a paint/erase stroke

    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [panning, setPanning] = useState(null);        // { startX, startY, startPanX, startPanY } | null
    const [hoveredHex, setHoveredHex] = useState(null);  // { q, r } | null

    const svgRef = useRef(null);
    const zoomValueRef = useRef(1);
    const panXValueRef = useRef(0);
    const panYValueRef = useRef(0);
    const accumulatedDeltaRef = useRef(0);
    const isInitialized = useRef(false);
    const hasLoaded = useRef(false);

    // Computed SVG dimensions
    const svgWidth = HEX_SIZE * Math.sqrt(3) * (gridSize + 0.5);
    const svgHeight = HEX_SIZE * 3 / 2 * gridSize + HEX_SIZE / 2;

    // ─── Zoom/Pan helpers ────────────────────────────────────────────────

    const zoomIn = useCallback(() => {
        setZoom(prev => Math.min(MAX_ZOOM, prev * 1.25));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom(prev => Math.max(MIN_ZOOM, prev * 0.8));
    }, []);

    const resetView = useCallback(() => {
        setZoom(1);
        setPanX(0);
        setPanY(0);
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
        const ZOOM_THRESHOLD = 30;
        let factor = 1;
        if (accumulated < -ZOOM_THRESHOLD) {
            factor = 1.025;
            accumulatedDeltaRef.current = 0;
        } else if (accumulated > ZOOM_THRESHOLD) {
            factor = 0.975;
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
        // Check if it's a POI type
        const poiType = POI_TYPES.find(t => t.id === dragData);
        if (!poiType) return;

        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= gridSize || hex.r < 0 || hex.r >= gridSize) return;

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
                    const loadedPois = existing.pois || [];
                    const loadedGridSize = existing.gridSize || DEFAULT_GRID_SIZE;
                    const loadedZoom = existing.zoom != null ? existing.zoom : 1;
                    const loadedPanX = existing.panX != null ? existing.panX : 0;
                    const loadedPanY = existing.panY != null ? existing.panY : 0;

                    // Set default type for backward compat
                    if (!existing.type) {
                        existing.type = 'outdoor';
                    }

                    setMapData(existing);
                    setGridSize(loadedGridSize);
                    setTerrain(loadedTerrain);
                    setPois(loadedPois);
                    setZoom(loadedZoom);
                    setPanX(loadedPanX);
                    setPanY(loadedPanY);
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

            const newData = {
                type: 'outdoor',
                gridSize: DEFAULT_GRID_SIZE,
                terrain: initialTerrain,
                pois: [],
                zoom: 1,
                panX: 0,
                panY: 0
            };

            setMapData(newData);
            setTerrain(initialTerrain);
            setGridSize(DEFAULT_GRID_SIZE);

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

    useEffect(() => {
        if (!hasLoaded.current) return;

        const dataToSave = {
            type: 'outdoor',
            gridSize,
            terrain,
            pois,
            zoom,
            panX,
            panY
        };
        mapsService.saveMapData(campaignName, mapName, dataToSave)
            .catch(err => console.error('Failed to save hex map data:', err));
    }, [campaignName, mapName, terrain, pois, gridSize, zoom, panX, panY]);

    // ─── Sync state to refs for use in event handlers ──────────────────

    useEffect(() => { zoomValueRef.current = zoom; }, [zoom]);
    useEffect(() => { panXValueRef.current = panX; }, [panX]);
    useEffect(() => { panYValueRef.current = panY; }, [panY]);

    // ─── Render ─────────────────────────────────────────────────────────

    return (
        <div className="hex-map">
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
            />

            {loading ? (
                <div className="hex-map-loading">Loading map...</div>
            ) : (
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
                    onClick={() => { setSelectedPoiMenu(null); setShowRename(null); }}
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
                    <HexGridLayer
                        gridSize={gridSize}
                    />
                    <POILayer
                        pois={pois}
                        onPoiPointerDown={handlePoiPointerDown}
                        onPoiContextMenu={handlePoiContextMenu}
                        poiDragging={poiDragging}
                        poiHover={null}
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

                    {/* Context menu for POIs */}
                    <POIContextMenu
                        selectedPoi={selectedPoiMenu}
                        pois={pois}
                        showRename={showRename}
                        onToggleVisibility={handleTogglePoiVisibility}
                        onDelete={handleDeletePoi}
                        onRename={handleRenamePoi}
                        onClose={() => { setSelectedPoiMenu(null); setShowRename(null); }}
                        setShowRename={setShowRename}
                    />
                </svg>
            )}

            {/* POI Panel overlay */}
            {poiPanelOpen && (
                <POIPanel
                    poiPanelOpen={poiPanelOpen}
                    onClose={() => setPoiPanelOpen(false)}
                />
            )}
        </div>
    );
}

export default HexMap;
