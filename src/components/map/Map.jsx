import React, { useState, useEffect, useCallback, useRef } from 'react';
import utils from '../../services/utils.js';
import * as mapsService from '../../services/mapsService.js';
import Subscriber from '../common/Subscriber.jsx';
import MapToolbar from './MapToolbar.jsx';
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
import BookshelfSVG from './BookshelfSVG.jsx';
import ChairSVG from './ChairSVG.jsx';
import ChestSVG from './ChestSVG.jsx';
import CrateSVG from './CrateSVG.jsx';
import FountainSVG from './FountainSVG.jsx';
import SkeletonSVG from './SkeletonSVG.jsx';
import StatueSVG from './StatueSVG.jsx';
import TorchSVG from './TorchSVG.jsx';
import WebSVG from './WebSVG.jsx';
import PlacedItems from './PlacedItems.jsx';
import GridAndWalls from './GridAndWalls.jsx';
import Creatures from './Creatures.jsx';
import FogOverlay from './FogOverlay.jsx';
import BarrelContextMenu from './BarrelContextMenu.jsx';
import usePlacedItems from './hooks/usePlacedItems.js';
import useCreatureDragging from './hooks/useCreatureDragging';
import useItemDragging from './hooks/useItemDragging';
import useNpcImageCache from './hooks/useNpcImageCache';
import useSSESync from './hooks/useSSESync';

const CELL_SIZE = 40;

function Map({ campaignName, characters, npcs, isLocalhost, mapName, onBack }) {
    const [gridSize, setGridSize] = useState(20);
    const SVG_SIZE = gridSize * CELL_SIZE;
    const [mapData, setMapData] = useState(null);
    const svgRef = useRef(null);
    const isInitialized = useRef(false);

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
    // Tool state: 'none' | 'paint' | 'erase' | 'fog' | 'clearFog'
    const [tool, setTool] = useState('none');
    // Paint state: tracks grid coords during active paint/erase
    const [painting, setPainting] = useState(null);
    const [panning, setPanning] = useState(null); // { startX, startY, startPanX, startPanY }

    // Items panel state
    const [itemsPanelOpen, setItemsPanelOpen] = useState(false);
    const [placedItems, setPlacedItems] = useState([]);

    // Fog of war: Set of "gridX,gridY" strings for cells that are fogged
    const [fog, setFog] = useState(null);
    // Fog rectangle drag state: start/end grid coords during drag
    const [fogDragStart, setFogDragStart] = useState(null); // { gridX, gridY } | null
    const [fogDragEnd, setFogDragEnd] = useState(null);     // { gridX, gridY } | null

    // Barrel context menu state
    const [selectedBarrel, setSelectedBarrel] = useState(null); // { id, gridX, gridY }
    const [showRename, setShowRename] = useState(null);

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
    }, [gridSize, panX, panY]);

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

    const handlePanStart = useCallback((e) => {
        if (tool === 'paint' || tool === 'erase') {
            handleGridPointerDown(e);
            return;
        }
        if (tool === 'fog' || tool === 'clearFog') {
            handleFogPointerDown(e);
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
    }, [tool, panX, panY]);

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

    // Load or initialize map data on mount
    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

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

                    // Load fog data: if no fog data or empty array, fog all cells
                    if (!existing.fog || existing.fog.length === 0) {
                        const gs = existing.gridSize ||20;
                        const allFogged = new Set();
                        for (let x = 0; x < gs; x++) {
                            for (let y = 0; y < gs; y++) {
                                allFogged.add(`${x},${y}`);
                            }
                        }
                        setFog(allFogged);
                    } else {
                        setFog(new Set(existing.fog));
                    }

                    // If no creatures exist but characters are available, initialize creature positions
                    if ((!existing.creatures || existing.creatures.length === 0) && characters && characters.length > 0) {
                        const gs = existing.gridSize || 20;
                        const initialCreatures = characters.map((character, i) => ({
                            id: character.id || `creature-${i}-${Date.now()}`,
                            name: character.name || 'Unknown',
                            gridX: Math.min(1 + (i * 2) % gs, gs - 1),
                            gridY: Math.min(1 + Math.floor((i * 2) / gs), gs - 1),
                            imagePath: character.imagePath || ''
                        }));
                        setMapData(prev => ({ ...prev, creatures: initialCreatures }));
                    }

                    return;
                }
            } catch (err) {
                console.log('Map data not found, initializing empty map');
            }

            // Generate random positions with no collisions
            const creatures = characters.map((character) => ({
                id: utils.guid(),
                name: utils.getFirstName(character.name),
                gridX: 0,
                gridY: 0,
                imagePath: character.imagePath || ''
            }));

            const occupied = new Set();
            creatures.forEach((creature) => {
                let gridX, gridY, key;
                do {
                    gridX = Math.floor(Math.random() * gridSize); // 0–12
                    gridY = Math.floor(Math.random() * gridSize); // 0–12
                    key = `${gridX},${gridY}`;
                } while (occupied.has(key));
                occupied.add(key);
                creature.gridX = gridX;
                creature.gridY = gridY;
            });

            const newData = { creatures, walls: new Set() };

            // Fog all cells for new map
            const allFogged = new Set();
            for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                    allFogged.add(`${x},${y}`);
                }
            }

            setMapData(newData);
            setFog(allFogged);
            // Save initial data
            const dataToSave = {
                ...newData,
                gridSize,
                walls: [],
                placedItems: [],
                fog: Array.from(allFogged)
            };
            mapsService.saveMapData(campaignName, mapName, dataToSave).catch(err => console.error('Failed to save initial map data:', err));
        };

        loadMap();
    }, [campaignName, characters, mapName]);

    // Save map data whenever it changes
    useEffect(() => {
        if (!mapData) return;
        // Convert walls Set to array for storage
        const dataToSave = {
            ...mapData,
            gridSize,
            walls: Array.from(mapData.walls || []),
            placedItems: placedItems,
            fog: Array.from(fog || [])
        };
        mapsService.saveMapData(campaignName, mapName, dataToSave).catch(err => console.error('Failed to save map data:', err));
    }, [mapData, campaignName, gridSize, placedItems, mapName, fog]);

    // SSE handler for real-time updates from other clients
    const { handleSSEEvent } = useSSESync({
        campaignName,
        mapName,
        setGridSize,
        setMapData,
        setPlacedItems,
        setFog,
    });

    function handleFogPointerDown(e) {
        if (!isLocalhost) return;
        if (tool !== 'fog' && tool !== 'clearFog') return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;
        setFogDragStart(grid);
        setFogDragEnd(grid);
    }

    const handleFogPointerMove = useCallback((e) => {
        if (!isLocalhost) return;
        if (!fogDragStart || (tool !== 'fog' && tool !== 'clearFog')) return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;
        setFogDragEnd(grid);
    }, [tool, isLocalhost, fogDragStart, getGridFromEvent]);

    const handleFogPointerUp = useCallback(() => {
        if (!fogDragStart || !fogDragEnd) {
            setFogDragStart(null);
            setFogDragEnd(null);
            return;
        }

        // Calculate rectangle bounds regardless of drag direction
        const minX = Math.min(fogDragStart.gridX, fogDragEnd.gridX);
        const maxX = Math.max(fogDragStart.gridX, fogDragEnd.gridX);
        const minY = Math.min(fogDragStart.gridY, fogDragEnd.gridY);
        const maxY = Math.max(fogDragStart.gridY, fogDragEnd.gridY);

        setFog((prev) => {
            const newFog = new Set(prev);
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const key = `${x},${y}`;
                    if (tool === 'fog') {
                        newFog.add(key);
                    } else if (tool === 'clearFog') {
                        newFog.delete(key);
                    }
                }
            }
            return newFog;
        });

        setFogDragStart(null);
        setFogDragEnd(null);
    }, [tool, fogDragStart, fogDragEnd]);

    // Handle grid pointer down (paint/erase mode)
    function handleGridPointerDown(e) {
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
    }

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
    }, [painting, tool, isLocalhost, gridSize]);

    // Handle grid pointer up (end paint/erase)
    const handleGridPointerUp = useCallback(() => {
        setPainting(null);
    }, []);

    // Handle pointer leaving SVG during paint/erase
    const handleGridPointerLeave = useCallback(() => {
        setPainting(null);
    }, []);

    const { dragging, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave } = useCreatureDragging({
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
            rotation: (dragData === 'table' || dragData === 'bed' || dragData === 'stairs' || dragData === 'altar' || dragData === 'bookshelf' || dragData === 'torch' || dragData === 'chair') ? 0 : undefined
        };
        setPlacedItems(prev => [...prev, newItem]);
    }, [isLocalhost, gridSize]);

    const handleRenameItem = useCallback((itemId, newName) => {
        if (!newName || !newName.trim()) return;
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, name: newName.trim() } : item
            )
        );
        setShowRename(null);
        setSelectedBarrel(null);
        // Clear the cached image so it gets recomputed
        setNpcImages(prev => ({ ...prev, [itemId]: null }));
    }, []);

    const {
        handleToggleItemVisibility,
        handleDeleteItem,
        handleRotateTable,
        handleRotateBed,
        handleRotateDoor,
        handleRotateSecretDoor,
        handleRotateStairs,
        handleRotateAltar,
        handleRotateBookshelf,
        handleRotateTorch,
        handleRotateChair,
    } = usePlacedItems(setPlacedItems, setSelectedBarrel);

    // Close context menu
    const handleCloseMenu = useCallback(() => {
        setSelectedBarrel(null);
    }, []);

    const { npcImages, setNpcImages } = useNpcImageCache(placedItems);

    // Sync state to refs so handleWheel always reads latest values
    useEffect(() => { zoomValueRef.current = zoom; }, [zoom]);
    useEffect(() => { panXValueRef.current = panX; }, [panX]);
    useEffect(() => { panYValueRef.current = panY; }, [panY]);



    if (!mapData) return null;

    const { creatures, walls } = mapData;

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
            />
            <Subscriber handleEvent={handleSSEEvent} />
            <svg
                ref={svgRef}
                viewBox={`${panX} ${panY} ${SVG_SIZE / zoom} ${SVG_SIZE / zoom}`}
                className="grid-svg"
                onPointerDown={handlePanStart}
                onPointerMove={(e) => { handlePointerMove(e); handleItemPointerMove(e); handleGridPointerMove(e); handleFogPointerMove(e); handlePanMove(e); }}
                onPointerUp={(e) => { handlePointerUp(e); handleItemPointerUpHook(e); handleGridPointerUp(e); handleFogPointerUp(e); handlePanEnd(e); }}
                onPointerLeave={(e) => { handleItemPointerLeave(); handleGridPointerLeave(e); handleFogPointerUp(); }}
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
                    <BookshelfSVG id="bookshelf" />
                    <ChairSVG id="chair" />
                    <ChestSVG id="chest" />
                    <CrateSVG id="crate" />
                    <FountainSVG id="fountain" />
                    <SkeletonSVG id="skeleton" />
                    <StatueSVG id="statue" />
                    <TorchSVG id="torch" />
                    <WebSVG id="web" />
                </defs>

                <GridAndWalls
                    gridSize={gridSize}
                    walls={walls}
                    isLocalhost={isLocalhost}
                    fog={fog}
                />

                {/* Characters */}
                <Creatures
                    creatures={creatures}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    isLocalhost={isLocalhost}
                    fog={fog}
                    dragging={dragging}
                    handlePointerDown={handlePointerDown}
                />

                {/* Placed items */}
                <PlacedItems
                    placedItems={placedItems}
                    isLocalhost={isLocalhost}
                    fog={fog}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    setSelectedBarrel={setSelectedBarrel}
                    npcImages={npcImages}
                    itemDragging={itemDragging}
                    handleItemPointerDown={handleItemPointerDown}
                />

                <FogOverlay
                    fog={fog}
                    isLocalhost={isLocalhost}
                    fogDragStart={fogDragStart}
                    fogDragEnd={fogDragEnd}
                />

                {/* Item context menu */}
                <BarrelContextMenu
                    selectedBarrel={selectedBarrel}
                    showRename={showRename}
                    placedItems={placedItems}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    handleToggleItemVisibility={handleToggleItemVisibility}
                    handleDeleteItem={handleDeleteItem}
                    handleRotateTable={handleRotateTable}
                    handleRotateBed={handleRotateBed}
                    handleRotateDoor={handleRotateDoor}
                    handleRotateSecretDoor={handleRotateSecretDoor}
                    handleRotateStairs={handleRotateStairs}
                    handleRotateAltar={handleRotateAltar}
                    handleRotateBookshelf={handleRotateBookshelf}
                    handleRotateTorch={handleRotateTorch}
                    handleRotateChair={handleRotateChair}
                    handleRenameItem={handleRenameItem}
                    setShowRename={setShowRename}
                    setSelectedBarrel={setSelectedBarrel}
                />
            </svg>

            {/* Items panel sidebar */}
            {isLocalhost && itemsPanelOpen && (
                <ItemsPanel
                    itemsPanelOpen={itemsPanelOpen}
                    placedItems={placedItems}
                    onToggleItemVisibility={handleToggleItemVisibility}
                    onClose={() => setItemsPanelOpen(false)}
                />
            )}
        </div>
    );
}

export default Map;
