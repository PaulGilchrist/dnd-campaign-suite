import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import * as mapsService from '../../services/maps/mapsService.js';
import { generateWeather } from '../../services/campaign/weatherService.js';
import {
    HEX_SIZE, GRID_COLS_MULTIPLIER,
    TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_RIVER, TOOL_PAN, TOOL_TRAVEL, TOOL_ROAD,
    TERRAIN_TYPES, POI_TYPES
} from '../../config/outdoorConfig.js';
import { hexKey, hexToPixel, hexToSVGPath } from '../../services/maps/hexMapUtils.js';
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
import useTravelManagement from '../../hooks/management/useTravelManagement.js';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import TravelPanel from './TravelPanel.jsx';
import TravelPathLayer from './TravelPathLayer.jsx';
import useLog from '../../hooks/runtime/useLog.js';
import WeatherOverlay from './WeatherOverlay.jsx';
import EventDialog from './EventDialog.jsx';
import useZoomPan from './hooks/useZoomPan.js';
import useHexHover from './hooks/useHexHover.js';
import useTerrainPainting from './hooks/useTerrainPainting.js';
import usePoiManagement from './hooks/usePoiManagement.js';
import useMapLoader from './hooks/useMapLoader.js';
import useTravelToolSync from './hooks/useTravelToolSync.js';
import useEncounterGeneration from './hooks/useEncounterGeneration.js';
import './HexMap.css';

function HexMap({ campaignName, mapName, onBack, characters = [], onEncounterCreated, isLocalhost = false, onPoiEntered }) {
    const svgRef = useRef(null);

    // ── Core map data (load/init/save) ──
    const mapLoader = useMapLoader(campaignName, mapName, characters);
    const {
        loading, setMapData,
        gridSize, setGridSize,
        terrain, setTerrain,
        rivers, setRivers,
        roads, setRoads,
        pois, setPois,
        marchingOrder, setMarchingOrder,
        partyPosition, setPartyPosition,
        weather, setWeather,
        travelInit, setTravelInit,
        setTravelStateRef,
        zoom, setZoom,
        panX, setPanX,
        panY, setPanY,
        needsResetViewRef,
    } = mapLoader;

    const hexCols = gridSize * GRID_COLS_MULTIPLIER;
    const hexRows = gridSize;

    // ── Zoom/pan interaction ──
    const zoomPan = useZoomPan(svgRef, hexCols, hexRows, zoom, setZoom, panX, setPanX, panY, setPanY);
    const { svgWidth, svgHeight, zoomIn, zoomOut, resetView, clampPan, centerView,
        panning, handlePanStart, handlePanMove, handlePanEnd, handleWheel } = zoomPan;

    // ── Hex hover & coordinate conversion ──
    const hexHover = useHexHover(svgRef, hexCols, hexRows);
    const { hoveredHex, setHoveredHex, getHexFromEvent, handleHexHover } = hexHover;

    // ── Tool state ──
    const [tool, setTool] = useState(TOOL_NONE);
    const [selectedTerrain, setSelectedTerrain] = useState(TERRAIN_TYPES[0].id);
    const [poiPanelOpen, setPoiPanelOpen] = useState(false);
    const [marchingOpen, setMarchingOpen] = useState(false);
    const [partyContextMenu, setPartyContextMenu] = useState(null);

    // ── Terrain painting ──
    const terrainPainting = useTerrainPainting(hexCols, hexRows, getHexFromEvent, selectedTerrain, setTerrain, setRivers);
    const { handleTerrainPointerDown, handleTerrainPointerMove, handleTerrainPointerUp } = terrainPainting;

    // ── Travel management ──
    const { monsters } = useMonstersData();
    const playerLevels = useMemo(() => characters.map(c => c.level || 1), [characters]);

    const travelMgmt = useTravelManagement({
        hexCols, hexRows, terrain, partyPosition,
        onPartyMove: setPartyPosition,
        weather, monsters, playerLevels, roads, characters, campaignName,
        initialTravelState: travelInit,
        onTravelStateChange: setTravelStateRef,
    });

    const handleGenerateWeather = useCallback(() => {
        const terrainKey = partyPosition ? hexKey(partyPosition.q, partyPosition.r) : null;
        const currentTerrain = terrainKey ? terrain[terrainKey] || 'plains' : 'plains';
        setWeather(generateWeather(currentTerrain));
    }, [partyPosition, terrain, setWeather]);

    // ── Travel tool sync ──
    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool);

    // ── POI management ──
    const poiMgmt = usePoiManagement(pois, setPois, roads, setRoads, terrain, hexCols, hexRows, getHexFromEvent, tool);
    const {
        selectedPoiMenu, setSelectedPoiMenu,
        showRename, setShowRename,
        poiDragging,
        roadStartPoiId, setRoadStartPoiId,
        handlePoiPointerDown, handlePoiPointerMove, handlePoiPointerUp,
        handlePoiContextMenu, handleTogglePoiVisibility, handleDeletePoi,
        handleRenamePoi, handleLinkMap, handleUnlinkMap, handleRemoveRoads,
    } = poiMgmt;

    // ── Encounter generation ──
    const { generateMonsterPlacements, handleStartEncounter } = useEncounterGeneration(
        campaignName, mapName, terrain, marchingOrder, onEncounterCreated
    );

    // ── Logging ──
    const { addEntry } = useLog(campaignName);

    const logTravel = useCallback((action, hex, tileTerrain, w, evt) => {
        addEntry({
            type: 'travel', action,
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

    // ── Indoor map linking ──
    const [indoorMaps, setIndoorMaps] = useState([]);
    const validLinkedMapsRef = useRef(new Set());
    const [validLinkedMaps, setValidLinkedMaps] = useState(new Set());

    useEffect(() => {
        let cancelled = false;
        mapsService.loadMaps(campaignName).then(result => {
            if (cancelled) return;
            setIndoorMaps(result.maps.filter(m => m.type === 'indoor').map(m => m.name));
        }).catch(err => console.error('[HexMap] Failed to load indoor maps:', err));
        return () => { cancelled = true; };
    }, [campaignName]);

    useEffect(() => {
        const linkedMaps = pois.filter(p => p.linkedMap).map(p => p.linkedMap);
        const unique = [...new Set(linkedMaps)];
        if (unique.length === 0) {
            validLinkedMapsRef.current = new Set();
            setValidLinkedMaps(new Set());
            return;
        }
        let cancelled = false;
        Promise.allSettled(
            unique.map(name =>
                mapsService.loadMapData(campaignName, name).then(() => name).catch(() => null)
            )
        ).then(results => {
            if (cancelled) return;
            const valid = new Set(results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value));
            validLinkedMapsRef.current = valid;
            setValidLinkedMaps(valid);
        });
        return () => { cancelled = true; };
    }, [campaignName, pois]);

    // ── SSE sync ──
    const { handleSSEEvent } = useHexMapSSESync({
        campaignName, mapName, setGridSize, setTerrain, setRivers, setRoads, setPois,
        setZoom, setPanX, setPanY, setMarchingOrder, setPartyPosition, setMapData,
        setWeather,
        onTravelStateChange: (ts) => {
            if (ts) {
                setTravelInit(ts);
            }
        },
    });

    // ── View reset on grid size change ──
    useLayoutEffect(() => {
        if (needsResetViewRef.current) {
            needsResetViewRef.current = false;
            const clamped = centerView(2);
            setZoom(2);
            setPanX(clamped.x);
            setPanY(clamped.y);
            return;
        }
        const clamped = clampPan(zoom, panX, panY);
        if (clamped.x !== panX) setPanX(clamped.x);
        if (clamped.y !== panY) setPanY(clamped.y);
    }, [zoom, gridSize, clampPan, centerView, setZoom, setPanX, setPanY, panX, panY, needsResetViewRef]);

    const viewPortBounds = useMemo(() => ({
        left: panX, top: panY,
        right: panX + svgWidth / zoom,
        bottom: panY + svgHeight / zoom,
    }), [panX, panY, svgWidth, svgHeight, zoom]);

    // ── POI enter handler ──
    const handlePoiEnter = useCallback((poi) => {
        if (poi.linkedMap && validLinkedMapsRef.current.has(poi.linkedMap) && onPoiEntered) {
            onPoiEntered(poi.linkedMap);
        }
    }, [onPoiEntered]);

    // ── Event handlers ──
    const handleEventAccept = useCallback(() => {
        const evt = travelMgmt.acceptEvent();
        const pos = travelMgmt.currentPosition || partyPosition;
        if (evt?.type === 'combat') {
            if (pos && evt.encounter?.monsters) {
                const monsterItems = generateMonsterPlacements(evt.encounter.monsters, 30);
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
    }, [travelMgmt, partyPosition, handleStartEncounter, generateMonsterPlacements, handleGenerateWeather, terrain, weather, logTravel]);

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

    // ── POI drop from panel ──
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const dragData = e.dataTransfer.getData('text/plain');
        if (!dragData) return;

        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= hexCols || hex.r < 0 || hex.r >= hexRows) return;

        if (dragData.startsWith('character:')) {
            const charName = dragData.slice('character:'.length);
            setMarchingOrder(prev => prev.includes(charName) ? prev : [...prev, charName]);
            setPartyPosition(prev => prev || { q: hex.q, r: hex.r });
            return;
        }

        const poiType = POI_TYPES.find(t => t.id === dragData);
        if (!poiType) return;

        if (pois.some(p => p.q === hex.q && p.r === hex.r)) return;

        setPois(prev => [...prev, {
            id: `poi-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            type: poiType.id, q: hex.q, r: hex.r,
            visible: true, label: poiType.name,
        }]);
    }, [pois, getHexFromEvent, hexCols, hexRows, setMarchingOrder, setPartyPosition, setPois]);

    return (
        <div className="hex-map">
            <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />
            <HexMapToolbar
                onBack={onBack}
                mapName={mapsService.formatMapName(mapName)}
                tool={tool} setTool={setTool}
                selectedTerrain={selectedTerrain} setSelectedTerrain={setSelectedTerrain}
                terrainTypes={TERRAIN_TYPES}
                zoomIn={zoomIn} zoomOut={zoomOut} resetView={resetView}
                zoom={zoom}
                poiPanelOpen={poiPanelOpen} setPoiPanelOpen={setPoiPanelOpen}
                gridSize={gridSize} setGridSize={setGridSize}
                marchingOrderOpen={marchingOpen} setMarchingOrderOpen={setMarchingOpen}
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
                                handleTerrainPointerDown(e, tool);
                            } else {
                                handlePanStart(e);
                            }
                        }}
                        onPointerMove={(e) => {
                            handlePanMove(e);
                            handleTerrainPointerMove(e, tool);
                            handlePoiPointerMove(e);
                            handleHexHover(e);
                        }}
                        onPointerUp={() => {
                            handlePanEnd();
                            handleTerrainPointerUp();
                            handlePoiPointerUp();
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
                            cursor: panning ? 'grabbing'
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

                        <TerrainLayer hexCols={hexCols} hexRows={hexRows} terrain={terrain} />
                        <RiverLayer rivers={rivers} hexCols={hexCols} hexRows={hexRows} />
                        <HexGridLayer hexCols={hexCols} hexRows={hexRows} />
                        <RoadLayer roads={roads} />
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
                            hexCols={hexCols} hexRows={hexRows}
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

                        {hoveredHex && (tool === TOOL_PAINT || tool === TOOL_ERASE) && (() => {
                            const center = hexToPixel(hoveredHex.q, hoveredHex.r, HEX_SIZE);
                            const pathD = hexToSVGPath(center.x, center.y, HEX_SIZE);
                            return (
                                <path d={pathD} fill="rgba(255,255,255,0.15)" stroke="#FFD700" strokeWidth={1.5} pointerEvents="none" />
                            );
                        })()}

                        {hoveredHex && tool === TOOL_RIVER && (() => {
                            const center = hexToPixel(hoveredHex.q, hoveredHex.r, HEX_SIZE);
                            const pathD = hexToSVGPath(center.x, center.y, HEX_SIZE);
                            const key = hexKey(hoveredHex.q, hoveredHex.r);
                            const hasRiver = rivers.includes(key);
                            return (
                                <path d={pathD} fill={hasRiver ? 'rgba(200,50,50,0.15)' : 'rgba(60,130,210,0.2)'} stroke={hasRiver ? '#c44' : '#4A90D9'} strokeWidth={1.5} pointerEvents="none" />
                            );
                        })()}

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

                    <div className="hex-map-compass no-print">
                        <svg viewBox="0 0 48 48" width="44" height="44">
                            <polygon points="24,2 28,20 46,24 28,28 24,46 20,28 2,24 20,20" fill="#666" stroke="#999" strokeWidth="0.5" />
                            <polygon points="24,2 28,20 24,24 20,20" fill="#c44" />
                            <polygon points="24,46 28,28 24,24 20,28" fill="#555" />
                            <text x="24" y="15" textAnchor="middle" fill="#c44" fontSize="6" fontWeight="bold">N</text>
                        </svg>
                        <div className="hex-map-legend">
                            <div className="hex-map-legend-line">
                                <svg viewBox="0 0 30 12" width="30" height="12">
                                    <line x1="0" y1="6" x2="30" y2="6" stroke="#ccc" strokeWidth="1.5" />
                                    <line x1="0" y1="3" x2="0" y2="9" stroke="#ccc" strokeWidth="1" />
                                    <line x1="30" y1="3" x2="30" y2="9" stroke="#ccc" strokeWidth="1" />
                                </svg>
                            </div>
                            <span className="hex-map-legend-text">1 hex = 6 miles</span>
                        </div>
                    </div>

                    <div className="no-print"><WeatherOverlay weather={weather} /></div>
                </div>
            )}

            {marchingOpen && (
                <div className="no-print">
                    <MarchingOrderPanel
                        marchingOrder={marchingOrder}
                        setMarchingOrder={setMarchingOrder}
                        characters={characters}
                        onClose={() => setMarchingOpen(false)}
                    />
                </div>
            )}

            {poiPanelOpen && (
                <div className="no-print">
                    <POIPanel poiPanelOpen={poiPanelOpen} onClose={() => setPoiPanelOpen(false)} />
                </div>
            )}

            <div className="no-print">
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
                    forcedMarchHours={travelMgmt.forcedMarchHours}
                    exhaustionMultiplier={travelMgmt.exhaustionMultiplier}
                    partyHasMaxExhaustion={travelMgmt.partyHasMaxExhaustion}
                />

                <EventDialog
                    event={travelMgmt.pendingEvent}
                    rerollsRemaining={travelMgmt.rerollsRemaining}
                    onAccept={handleEventAccept}
                    onSkip={handleEventSkip}
                    onReroll={handleEventReroll}
                />
            </div>
        </div>
    );
}

export default HexMap;
