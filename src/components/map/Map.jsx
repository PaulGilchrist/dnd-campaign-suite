import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import utils from '../../services/utils.js';
import * as mapsService from '../../services/mapsService.js';
import Subscriber from '../common/Subscriber.jsx';
import MapToolbar from './MapToolbar.jsx';
import { loadMonsters } from '../../services/dataLoader.js';
import MonsterCardModal from '../encounter/MonsterCardModal.jsx';
import './Map.css';
import ItemsPanel from './ItemsPanel.jsx';
import BarrelSVG from './BarrelSVG.jsx';
import TableSVG from './TableSVG.jsx';
import BedSVG from './BedSVG.jsx';
import FirePitSVG from './FirePitSVG.jsx';
import DoorSVG from './DoorSVG.jsx';
import SecretDoorSVG from './SecretDoorSVG.jsx';
import TrapSVG from './TrapSVG.jsx';
import PillarSVG from './PillarSVG.jsx';
import StairsSVG from './StairsSVG.jsx';
import AltarSVG from './AltarSVG.jsx';
import ArrowSlitWallSVG from './ArrowSlitWallSVG.jsx';
import BookshelfSVG from './BookshelfSVG.jsx';
import ChairSVG from './ChairSVG.jsx';
import ChestSVG from './ChestSVG.jsx';
import CrateSVG from './CrateSVG.jsx';
import FountainSVG from './FountainSVG.jsx';
import SkeletonSVG from './SkeletonSVG.jsx';
import StatueSVG from './StatueSVG.jsx';
import TorchSVG from './TorchSVG.jsx';
import WebSVG from './WebSVG.jsx';
import TreeSVG from './TreeSVG.jsx';
import BoulderSVG from './BoulderSVG.jsx';
import BushSVG from './BushSVG.jsx';
import PlacedItems from './PlacedItems.jsx';
import GridAndWalls from './GridAndWalls.jsx';
import Players from './Players.jsx';
import FogOverlay from './FogOverlay.jsx';
import ItemContextMenu from './ItemContextMenu.jsx';
import MonsterNameAutocomplete from '../common/MonsterNameAutocomplete.jsx';
import usePlacedItems from './hooks/usePlacedItems.js';
import usePlayerDragging from './hooks/usePlayerDragging';
import useItemDragging from './hooks/useItemDragging';
import useNpcImageCache from './hooks/useNpcImageCache';
import useSSESync from './hooks/useSSESync';
import useFogOfWar from './hooks/useFogOfWar';
import HexMap from '../hex-map/HexMap';
import '../hex-map/HexMap.css';

const CELL_SIZE = 40;

function Map({ campaignName, characters, isLocalhost, mapName, onBack, onEncounterCreated, onPoiEntered }) {
    const [gridSize, setGridSize] = useState(20);
    const SVG_SIZE = gridSize * CELL_SIZE;
    const [mapData, setMapData] = useState(null);
    const svgRef = useRef(null);
    const loadInProgressRef = useRef(false);
    const loadedMapNameRef = useRef(null);

    // Zoom/Pan state
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);

    // Refs for zoom/pan state used by handleWheel (avoids stale closure)
    const zoomValueRef = useRef(1);
    const panXValueRef = useRef(0);
    const panYValueRef = useRef(0);
    // Accumulate deltaY for smooth zoom thresholding
    const accumulatedDeltaRef = useRef(0);
    // Tool state: 'none' | 'paint' | 'erase'
    const [tool, setTool] = useState('none');
    // Paint state: tracks grid coords during active paint/erase
    const [painting, setPainting] = useState(null);
    const [panning, setPanning] = useState(null); // { startX, startY, startPanX, startPanY }

    // Items panel state
    const [itemsPanelOpen, setItemsPanelOpen] = useState(false);
    const [placedItems, setPlacedItems] = useState([]);

    // Item context menu state
    const [selectedItem, setSelectedItem] = useState(null); // { id, gridX, gridY }
    const [renamePopover, setRenamePopover] = useState(null); // { itemId, name } | null

    // Monster card modal state
    const [viewingMonster, setViewingMonster] = useState(null);
    const [monstersLoaded, setMonstersLoaded] = useState([]);

    // Load monster data for NPC context menu
    useEffect(() => {
        loadMonsters().then(setMonstersLoaded).catch(() => {});
    }, []);

    // Handle "View Stats" for NPC context menu
    const handleViewStats = useCallback((itemId) => {
        const item = placedItems.find(i => i.id === itemId);
        if (!item || item.type !== 'npc') return;
        const baseName = (item.name || '').replace(/\s+\d+$/, '');
        const monster = (monstersLoaded || []).find(
            m => m.name.toLowerCase() === baseName.toLowerCase()
        );
        if (monster) {
            setViewingMonster(monster);
        }
    }, [placedItems, monstersLoaded]);

    const monsterFound = useMemo(() => {
        if (!selectedItem) return false;
        const item = placedItems.find(i => i.id === selectedItem.id);
        if (!item || item.type !== 'npc') return false;
        const baseName = (item.name || '').replace(/\s+\d+$/, '');
        return (monstersLoaded || []).some(
            m => m.name.toLowerCase() === baseName.toLowerCase()
        );
    }, [selectedItem, placedItems, monstersLoaded]);

    // Player context menu state
    const [selectedPlayer, setSelectedPlayer] = useState(null); // { id, name, gridX, gridY } | null

    // Zoom/Pan helpers
    const gridCenterX = useCallback((gridX) => gridX * CELL_SIZE + CELL_SIZE / 2, []);
    const gridCenterY = useCallback((gridY) => gridY * CELL_SIZE + CELL_SIZE / 2, []);

    const getGridFromEvent = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;
        const gridX = Math.max(0, Math.min(gridSize - 1, Math.floor(svgX / CELL_SIZE)));
        const gridY = Math.max(0, Math.min(gridSize - 1, Math.floor(svgY / CELL_SIZE)));
        return { gridX, gridY };
    }, [gridSize]);

    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 4;

    const zoomIn = useCallback(() => {
        setZoom((prev) => Math.min(MAX_ZOOM, prev * 1.25));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom((prev) => Math.max(MIN_ZOOM, prev * 0.8));
    }, []);

    const resetView = useCallback(() => {
        setZoom(1);
        setPanX(0);
        setPanY(0);
    }, []);

    // Handle grid pointer down (paint/erase mode)
    const handleGridPointerDown = useCallback((e) => {
        if (!isLocalhost) return;
        if (tool === 'none') return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;

        const key = `${grid.gridX},${grid.gridY}`;
        setMapData((prev) => {
            const newWalls = new Set(prev.walls);
            if (tool === 'paint') {
                newWalls.add(key);
            } else if (tool === 'erase') {
                newWalls.delete(key);
            }
            return { ...prev, walls: newWalls };
        });
        setPainting(grid);
    }, [isLocalhost, tool, getGridFromEvent]);

    // Handle grid pointer move (paint/erase drag)
    const handleGridPointerMove = useCallback((e) => {
        if (!isLocalhost) return;
        if (!painting || (tool !== 'paint' && tool !== 'erase')) return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;

        const key = `${grid.gridX},${grid.gridY}`;
        setMapData((prev) => {
            const newWalls = new Set(prev.walls);
            if (tool === 'paint') {
                newWalls.add(key);
            } else if (tool === 'erase') {
                newWalls.delete(key);
            }
            return { ...prev, walls: newWalls };
        });
    }, [painting, tool, isLocalhost, getGridFromEvent]);

    // Handle grid pointer up (end paint/erase)
    const handleGridPointerUp = useCallback(() => {
        setPainting(null);
    }, []);

    // Handle pointer leaving SVG during paint/erase
    const handleGridPointerLeave = useCallback(() => {
        setPainting(null);
    }, []);

    const handlePanStart = useCallback((e) => {
        if (tool === 'paint' || tool === 'erase') {
            handleGridPointerDown(e);
            return;
        }
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
    }, [tool, panX, panY, handleGridPointerDown]);

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

    // Load or initialize map data on mount
    useEffect(() => {
        if (loadedMapNameRef.current === mapName) return;
        loadedMapNameRef.current = mapName;
        loadInProgressRef.current = true;

        const loadMap = async () => {
            try {
                const existing = await mapsService.loadMapData(campaignName, mapName);
                if (existing) {
                    // LOAD PATH — entered for any existing map data (generated or hand-made)
                    const walls = existing.walls
                        ? new Set(existing.walls)
                        : new Set();
                    setMapData({ ...existing, walls });
                    setGridSize(existing.gridSize || 20);
                    setPlacedItems(existing.placedItems || []);

                    // Remove players whose characters no longer exist in the campaign
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
                console.log('Map data not found, initializing empty map');
            }

            const newData = { players: [], walls: new Set() };

            setMapData(newData);
            // Save initial data
            const dataToSave = {
                ...newData,
                gridSize,
                walls: [],
                placedItems: [],
            };
            mapsService.saveMapData(campaignName, mapName, dataToSave).catch(err => console.error('Failed to save initial map data:', err));
        };

        loadMap().finally(() => { loadInProgressRef.current = false; });
    }, [campaignName, characters, mapName, gridSize]);

    // Save map data whenever it changes
    useEffect(() => {
        if (!mapData) return;
        // Don't save stale mapData while a new map is loading
        if (loadInProgressRef.current) return;
        // Convert walls Set to array for storage
        const dataToSave = {
            ...mapData,
            gridSize,
            walls: Array.from(mapData.walls || []),
            placedItems: placedItems,
        };
        mapsService.saveMapData(campaignName, mapName, dataToSave).catch(err => console.error('Failed to save map data:', err));
    }, [mapData, campaignName, gridSize, placedItems, mapName]);

    // SSE handler for real-time updates from other clients
    const { handleSSEEvent } = useSSESync({
        campaignName,
        mapName,
        setGridSize,
        setMapData,
        setPlacedItems,
    });

    const { dragging, handlePointerDown, handlePointerMove, handlePointerUp } = usePlayerDragging({
        svgRef,
        mapData,
        gridSize,
        panX,
        panY,
        setMapData,
        gridCenterX,
        gridCenterY,
    });

    const { itemDragging, handleItemPointerDown, handleItemPointerMove, handleItemPointerUp: handleItemPointerUpHook, handleItemPointerLeave } = useItemDragging({
        svgRef,
        placedItems,
        setPlacedItems,
        gridSize,
        gridCenterX,
        gridCenterY,
    });

    const fog = useFogOfWar(mapData?.players, mapData?.walls, placedItems, gridSize);

    // Clear all walls and reset tool
    const handleClearWalls = useCallback(() => {
        if (window.confirm('Clear all painted walls?')) {
            setMapData((prev) => ({ ...prev, walls: new Set() }));
            setTool('none');
        }
    }, []);

    // Handle drop from items panel onto grid
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;
        const dragData = e.dataTransfer.getData('text/plain');
        if (!dragData) return;

        // Character drop from ItemsPanel — add player to map
        if (dragData.startsWith('character:')) {
            const charName = dragData.slice('character:'.length);
            setMapData(prev => {
                const existing = prev.players || [];
                if (existing.some(p => p.name === charName)) return prev;
                return {
                    ...prev,
                    players: [...existing, {
                        id: charName.toLowerCase().replace(/\s+/g, '-'),
                        name: charName,
                        gridX: grid.gridX,
                        gridY: grid.gridY
                    }]
                };
            });
            return;
        }

        // Generic NPC drop
        if (dragData === 'npc') {
            const newItem = {
                id: utils.guid(),
                type: 'npc',
                gridX: grid.gridX,
                gridY: grid.gridY,
                visible: isLocalhost,
                name: 'NPC',
            };
            setPlacedItems(prev => [...prev, newItem]);
            return;
        }

        const newItem = {
            id: utils.guid(),
            type: dragData,
            gridX: grid.gridX,
            gridY: grid.gridY,
            visible: isLocalhost,
            rotation: (dragData === 'table' || dragData === 'bed' || dragData === 'stairs' || dragData === 'altar' || dragData === 'bookshelf' || dragData === 'torch' || dragData === 'chair' || dragData === 'arrowSlitWall') ? 0 : undefined
        };
        setPlacedItems(prev => [...prev, newItem]);
    }, [isLocalhost, getGridFromEvent]);

    const { npcImages, setNpcImages } = useNpcImageCache(placedItems);

    const handleRenameItem = useCallback((itemId, newName) => {
        if (!newName || !newName.trim()) return;
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, name: newName.trim() } : item
            )
        );
        setRenamePopover(null);
        setSelectedItem(null);
        // Clear the cached image so it gets recomputed
        setNpcImages(prev => ({ ...prev, [itemId]: null }));
    }, [setNpcImages]);

    const {
        handleToggleItemVisibility,
        handleDeleteItem,
        handleToggleDoor,
        handleRotateTable,
        handleRotateBed,
        handleRotateDoor,
        handleRotateSecretDoor,
        handleRotateStairs,
        handleRotateAltar,
        handleRotateArrowSlitWall,
        handleRotateBookshelf,
        handleRotateTorch,
        handleRotateChair,
    } = usePlacedItems(setPlacedItems, setSelectedItem);

    const handleRemovePlayer = useCallback((playerId) => {
        setMapData(prev => ({
            ...prev,
            players: (prev.players || []).filter(p => p.id !== playerId)
        }));
        setSelectedPlayer(null);
    }, []);

// Close context menu
    const handleCloseMenu = useCallback(() => {
        setSelectedItem(null);
        setSelectedPlayer(null);
        setRenamePopover(null);
       }, []);

    // Open rename autocomplete as HTML overlay positioned near the context menu
        const handleRenameClicked = (event, item, defaultName) => {
            if (!svgRef.current) return;
            const svgRect = svgRef.current.getBoundingClientRect();

             // Convert SVG coords to DOM position
            const vbX = panX;
            const vbY = panY;
            const scaleX = svgRect.width / (SVG_SIZE / zoom);
            const scaleY = svgRect.height / (SVG_SIZE / zoom);

            const menuSvgX = gridCenterX(item.gridX) + 10;
            const menuSvgY = gridCenterY(item.gridY) + 10;

            const domX = svgRect.left + (menuSvgX - vbX) * scaleX;
            const domY = svgRect.top + (menuSvgY - vbY) * scaleY + 80;

            setSelectedItem(null);
            setRenamePopover({ itemId: item.id, name: defaultName || 'NPC', position: { left: `${domX}px`, top: `${domY}px` } });
             };

    // Sync state to refs so handleWheel always reads latest values
    useEffect(() => { zoomValueRef.current = zoom; }, [zoom]);
    useEffect(() => { panXValueRef.current = panX; }, [panX]);
    useEffect(() => { panYValueRef.current = panY; }, [panY]);



    if (!mapData) return null;

    // Outdoor map dispatcher — render HexMap for outdoor terrain maps
    if (mapData?.type === 'outdoor') {
        return <HexMap campaignName={campaignName} mapName={mapName} onBack={onBack} characters={characters} onEncounterCreated={onEncounterCreated} isLocalhost={isLocalhost} onPoiEntered={onPoiEntered} />;
    }

    const { players, walls } = mapData;

    return (
        <div className="map">
            <MapToolbar
                mapName={mapName}
                isLocalhost={isLocalhost}
                tool={tool}
                setTool={setTool}
                gridSize={gridSize}
                setGridSize={setGridSize}
                itemsPanelOpen={itemsPanelOpen}
                setItemsPanelOpen={setItemsPanelOpen}
                handleClearWalls={handleClearWalls}
                zoomIn={zoomIn}
                zoomOut={zoomOut}
                resetView={resetView}
                onBack={onBack}
            />
            <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />
            <svg
                ref={svgRef}
                viewBox={`${panX} ${panY} ${SVG_SIZE / zoom} ${SVG_SIZE / zoom}`}
                className="grid-svg"
                onPointerDown={handlePanStart}
                onPointerMove={(e) => { handlePointerMove(e); handleItemPointerMove(e); handleGridPointerMove(e); handlePanMove(e); }}
                onPointerUp={(e) => { handlePointerUp(e); handleItemPointerUpHook(e); handleGridPointerUp(e); handlePanEnd(e); }}
                onPointerLeave={(e) => { handleItemPointerLeave(); handleGridPointerLeave(e); }}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={handleCloseMenu}
                style={{ cursor: panning ? 'grabbing' : (tool === 'none' ? 'grab' : 'default') }}
            >
                <defs>
                    <BarrelSVG id="barrel" />
                    <TableSVG id="table" />
                    <BedSVG id="bed" />
                    <FirePitSVG id="firepit" />
                    <DoorSVG id="door" />
                    <SecretDoorSVG id="secretDoor" />
                    <TrapSVG id="trap" />
                    <PillarSVG id="pillar" />
                    <StairsSVG id="stairs" />
                    <AltarSVG id="altar" />
                    <ArrowSlitWallSVG id="arrowSlitWall" />
                    <BookshelfSVG id="bookshelf" />
                    <ChairSVG id="chair" />
                    <ChestSVG id="chest" />
                    <CrateSVG id="crate" />
                    <FountainSVG id="fountain" />
                    <SkeletonSVG id="skeleton" />
                    <StatueSVG id="statue" />
                    <TorchSVG id="torch" />
                    <WebSVG id="web" />
                    <TreeSVG id="tree" />
                    <BoulderSVG id="boulder" />
                    <BushSVG id="bush" />
                </defs>

                <GridAndWalls
                    gridSize={gridSize}
                    walls={walls}
                    isLocalhost={isLocalhost}
                    fog={fog}
                    bgFill={mapData.bgFill}
                />

                {/* Characters */}
                <Players
                    players={players}
                    characters={characters}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    isLocalhost={isLocalhost}
                    fog={fog}
                    dragging={dragging}
                    handlePointerDown={handlePointerDown}
                    selectedPlayer={selectedPlayer}
                    setSelectedPlayer={setSelectedPlayer}
                />

                {/* Placed items */}
                <PlacedItems
                    placedItems={placedItems}
                    isLocalhost={isLocalhost}
                    fog={fog}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    setSelectedItem={setSelectedItem}
                    npcImages={npcImages}
                    itemDragging={itemDragging}
                    handleItemPointerDown={handleItemPointerDown}
                />

                <FogOverlay
                    fog={fog}
                    isLocalhost={isLocalhost}
                />

                  {/* Item context menu */}
                   <ItemContextMenu
                      selectedItem={selectedItem}
                      placedItems={placedItems}
                      gridCenterX={gridCenterX}
                      gridCenterY={gridCenterY}
                      handleToggleItemVisibility={handleToggleItemVisibility}
                      handleDeleteItem={handleDeleteItem}
                      handleToggleDoor={handleToggleDoor}
                      handleRotateTable={handleRotateTable}
                      handleRotateBed={handleRotateBed}
                      handleRotateDoor={handleRotateDoor}
                      handleRotateSecretDoor={handleRotateSecretDoor}
                      handleRotateStairs={handleRotateStairs}
                      handleRotateAltar={handleRotateAltar}
                      handleRotateArrowSlitWall={handleRotateArrowSlitWall}
                      handleRotateBookshelf={handleRotateBookshelf}
                      handleRotateTorch={handleRotateTorch}
                      handleRotateChair={handleRotateChair}
                      handleViewStats={handleViewStats}
                      monsterFound={monsterFound}
                      onRenameClicked={handleRenameClicked}
                     onClose={handleCloseMenu}
                    />

                {/* Player context menu */}
                {selectedPlayer && (() => {
                    const menuX = gridCenterX(selectedPlayer.gridX) + 10;
                    const menuY = gridCenterY(selectedPlayer.gridY) + 10;
                    return (
                        <g className="item-context-menu" onClick={(e) => e.stopPropagation()}>
                            <g>
                                <rect x={menuX} y={menuY} width="120" height="36" rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                                <text
                                    x={menuX + 8}
                                    y={menuY + 24}
                                    fill="#ccc"
                                    fontSize="11"
                                    className="menu-option"
                                    onClick={() => handleRemovePlayer(selectedPlayer.id)}
                                >
                                    Remove from Map
                                </text>
                                <text
                                    x={menuX + 108}
                                    y={menuY + 12}
                                    fill="#999"
                                    fontSize="10"
                                    className="menu-close"
                                    onClick={() => setSelectedPlayer(null)}
                                >
                                    ✕
                                </text>
                            </g>
                        </g>
                    );
                })()}
            </svg>

              {/* NPC Rename Autocomplete Overlay */}
                  {renamePopover && (
                      <MonsterNameAutocomplete
                        key={renamePopover.itemId}
                        value={renamePopover.name}
                        position={renamePopover.position}
                        onCommit={(newName) => handleRenameItem(renamePopover.itemId, newName)}
                    />
                 )}

                 {/* Items panel sidebar */}
                  {isLocalhost && itemsPanelOpen && (
                      <ItemsPanel
                         itemsPanelOpen={itemsPanelOpen}
                         placedItems={placedItems}
                         onToggleItemVisibility={handleToggleItemVisibility}
                         onClose={() => setItemsPanelOpen(false)}
                         characters={characters}
                         players={players}
                         mapVariant={mapData.parentHex ? 'outdoor' : 'indoor'}
                      />
                  )}

            {/* Monster Card Modal for NPC context menu */}
            {viewingMonster && (
                <MonsterCardModal
                    monster={viewingMonster}
                    onClose={() => setViewingMonster(null)}
                    campaignName={campaignName}
                />
            )}
        </div>
    );
}

export default Map;
