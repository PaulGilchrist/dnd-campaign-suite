import React, { useState, useEffect, useCallback, useRef } from 'react';
import utils from '../../services/utils.js';
import * as mapsService from '../../services/mapsService.js';
import Subscriber from '../common/Subscriber.jsx';
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
import PlacedItems from './PlacedItems.jsx';
import GridAndWalls from './GridAndWalls.jsx';
import Creatures from './Creatures.jsx';
import FogOverlay from './FogOverlay.jsx';
import usePlacedItems from './hooks/usePlacedItems.js';
import { getMonsterImageUrl } from '../../services/monsterUtils.js';

const CELL_SIZE = 40;
const RADIUS = 20;

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
    // Drag state
    const [dragging, setDragging] = useState(null); // { creatureId, offsetX, offsetY }

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
    // Reposition mode state
    const [repositioningItemId, setRepositioningItemId] = useState(null);
    // NPC image cache
    const [npcImages, setNpcImages] = useState({});
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
    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.data) return;
        // Only process events for THIS map
        const expectedKey = `map-data-${campaignName}-${mapName}`;
        if (event.key !== expectedKey) return;

        const data = event.data;
        if (data.gridSize !== undefined) {
            setGridSize(data.gridSize);
        }
        setMapData((prev) => ({
            ...prev,
            creatures: data.creatures || prev?.creatures || [],
            walls: data.walls ? new Set(data.walls) : (prev?.walls || new Set())
        }));
        if (data.placedItems !== undefined) {
            setPlacedItems(data.placedItems);
        }
        if (data.fog !== undefined) {
            setFog(new Set(data.fog));
        }
    }, [campaignName, mapName]);

    // Calculate center of a grid square
    const gridCenterX = useCallback((gridX) => gridX * CELL_SIZE + CELL_SIZE / 2, []);
    const gridCenterY = useCallback((gridY) => gridY * CELL_SIZE + CELL_SIZE / 2, []);

    // Convert SVG pointer position to grid coordinates
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

    const handleFogPointerDown = useCallback((e) => {
        if (!isLocalhost) return;
        if (tool !== 'fog' && tool !== 'clearFog') return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;
        setFogDragStart(grid);
        setFogDragEnd(grid);
    }, [tool, getGridFromEvent, isLocalhost]);

    const handleFogPointerMove = useCallback((e) => {
        if (!isLocalhost) return;
        if (!fogDragStart || (tool !== 'fog' && tool !== 'clearFog')) return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;
        setFogDragEnd(grid);
    }, [tool, getGridFromEvent, isLocalhost, fogDragStart]);

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
    const handleGridPointerDown = useCallback((e) => {
        if (!isLocalhost) return;
        if (tool === 'none' && !repositioningItemId) return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;

        // Reposition mode: move the item to the clicked grid square
        if (repositioningItemId) {
            const item = placedItems.find(i => i.id === repositioningItemId);
            if (item) {
                setPlacedItems(prev =>
                    prev.map(i =>
                        i.id === repositioningItemId
                            ? { ...i, gridX: grid.gridX, gridY: grid.gridY }
                            : i
                    )
                );
            }
            setRepositioningItemId(null);
            return;
        }

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
    }, [tool, getGridFromEvent, repositioningItemId, placedItems]);

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
    }, [painting, tool, getGridFromEvent]);

    // Handle grid pointer up (end paint/erase)
    const handleGridPointerUp = useCallback(() => {
        setPainting(null);
    }, []);

    // Handle pointer leaving SVG during paint/erase
    const handleGridPointerLeave = useCallback(() => {
        setPainting(null);
    }, []);

    // Handle creature pointer down (drag)
    const handlePointerDown = useCallback((e, creatureId) => {
        e.stopPropagation();
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;

        const creature = mapData.creatures.find((c) => c.id === creatureId);
        if (!creature) return;

        const cx = gridCenterX(creature.gridX);
        const cy = gridCenterY(creature.gridY);

        setDragging({
            creatureId,
            offsetX: svgX - cx,
            offsetY: svgY - cy
        });
    }, [mapData, gridSize, panX, panY]);

    const handlePointerMove = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;

        const creature = mapData.creatures.find((c) => c.id === dragging.creatureId);
        if (!creature) return;

        const cx = svgX - dragging.offsetX;
        const cy = svgY - dragging.offsetY;

        const gridX = Math.floor(cx / CELL_SIZE);
        const gridY = Math.floor(cy / CELL_SIZE);

        const clampedGridX = Math.max(0, Math.min(gridSize - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(gridSize - 1, gridY));

        setMapData((prev) => ({
            ...prev,
            creatures: prev.creatures.map((c) =>
                c.id === dragging.creatureId ? { ...c, gridX: clampedGridX, gridY: clampedGridY } : c
            )
        }));
    }, [dragging, mapData, gridSize, panX, panY]);

    const handlePointerUp = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;

        const creature = mapData.creatures.find((c) => c.id === dragging.creatureId);
        if (!creature) {
            setDragging(null);
            return;
        }

        const cx = svgX - dragging.offsetX;
        const cy = svgY - dragging.offsetY;

        const gridX = Math.floor(cx / CELL_SIZE);
        const gridY = Math.floor(cy / CELL_SIZE);

        const clampedGridX = Math.max(0, Math.min(gridSize - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(gridSize - 1, gridY));

        // Collision detection: find the nearest unoccupied grid square
        const occupiedSquares = new Set(
            mapData.creatures
                .filter((c) => c.id !== dragging.creatureId)
                .map((c) => `${c.gridX},${c.gridY}`)
        );

        let targetX = clampedGridX;
        let targetY = clampedGridY;

        if (occupiedSquares.has(`${targetX},${targetY}`)) {
            const visited = new Set();
            const queue = [[targetX, targetY]];
            visited.add(`${targetX},${targetY}`);

            while (queue.length > 0) {
                const [x, y] = queue.shift();
                if (!occupiedSquares.has(`${x},${y}`)) {
                    targetX = x;
                    targetY = y;
                    break;
                }
                const neighbors = [
                    [x + 1, y],
                    [x - 1, y],
                    [x, y + 1],
                    [x, y - 1],
                ];
                for (const [nx, ny] of neighbors) {
                    const key = `${nx},${ny}`;
                    const clampedNx = Math.max(0, Math.min(gridSize - 1, nx));
                    const clampedNy = Math.max(0, Math.min(gridSize - 1, ny));
                    const clampedKey = `${clampedNx},${clampedNy}`;
                    if (!visited.has(clampedKey) && !occupiedSquares.has(clampedKey)) {
                        visited.add(clampedKey);
                        queue.push([clampedNx, clampedNy]);
                    }
                }
            }
        }

        setMapData((prev) => ({
            ...prev,
            creatures: prev.creatures.map((c) =>
                c.id === dragging.creatureId ? { ...c, gridX: targetX, gridY: targetY } : c
            )
        }));

        setDragging(null);
    }, [dragging, mapData, gridSize, panX, panY]);

    const handlePointerLeave = useCallback(() => {
        setDragging(null);
    }, []);

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
            rotation: (dragData === 'table' || dragData === 'bed' || dragData === 'stairs') ? 0 : undefined
        };
        setPlacedItems(prev => [...prev, newItem]);
    }, [getGridFromEvent, isLocalhost]);

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
        handleRepositionItem,
        handleRotateTable,
        handleRotateBed,
        handleRotateDoor,
        handleRotateSecretDoor,
        handleRotateStairs,
    } = usePlacedItems(setPlacedItems, setSelectedBarrel, setRepositioningItemId);

    // Close context menu and reposition mode
    const handleCloseMenu = useCallback(() => {
        setSelectedBarrel(null);
        setRepositioningItemId(null);
    }, []);

    // Fetch NPC images when placedItems change
    useEffect(() => {
        const npcItems = placedItems.filter(item => item.type === 'npc');
        const promises = npcItems.map(async (item) => {
            const url = await getMonsterImageUrl(item.name);
            return { id: item.id, url };
        });
        Promise.all(promises).then(results => {
            const newImages = {};
            results.forEach(({ id, url }) => { newImages[id] = url; });
            setNpcImages(newImages);
        });
    }, [placedItems]);

    // Sync state to refs so handleWheel always reads latest values
    useEffect(() => { zoomValueRef.current = zoom; }, [zoom]);
    useEffect(() => { panXValueRef.current = panX; }, [panX]);
    useEffect(() => { panYValueRef.current = panY; }, [panY]);

    // Zoom/Pan constants and helpers
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
        // Paint/erase take priority over panning
        if (tool === 'paint' || tool === 'erase') {
            handleGridPointerDown(e);
            return;
        }
        // Fog/clearFog take priority over panning
        if (tool === 'fog' || tool === 'clearFog') {
            handleFogPointerDown(e);
            return;
        }
        // Reposition mode takes priority over panning
        if (repositioningItemId) {
            handleGridPointerDown(e);
            return;
        }
        // Only pan when tool is 'none'
        // Only left mouse button (button 0)
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
    }, [tool, panX, panY, handleGridPointerDown, repositioningItemId]);

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

    if (!mapData) return null;

    const { creatures, walls } = mapData;

    return (
        <div className="map">
            <div className="toolbar-row">
                <h4>{mapsService.formatMapName(mapName) || 'Map'}</h4>
                {isLocalhost && (
                    <label className="grid-size-label">
                        Grid Size&nbsp;&nbsp;
                        <input
                            type="number"
                            min="5"
                            max="100"
                            value={gridSize}
                            onChange={(e) => setGridSize(Number(e.target.value))}
                            className="grid-size-input"
                        />
                    </label>
                )}
                <div className="toolbar">
                    {isLocalhost && (
                        <>
                            <button
                                className={tool === 'paint' ? 'active' : ''}
                                onClick={() => setTool(tool === 'paint' ? 'none' : 'paint')}
                            >
                                <i className="fa-solid fa-paint-brush"></i> Paint
                            </button>
                            <button
                                className={tool === 'erase' ? 'active' : ''}
                                onClick={() => setTool(tool === 'erase' ? 'none' : 'erase')}
                            >
                                <i className="fa-solid fa-eraser"></i> Erase
                            </button>
                            <button
                                onClick={handleClearWalls}
                            >
                                <i className="fa-solid fa-trash"></i> Clear Walls
                            </button>
                            <button
                                className={tool === 'fog' ? 'active' : ''}
                                onClick={() => setTool(tool === 'fog' ? 'none' : 'fog')}
                            >
                                <i className="fa-solid fa-cloud"></i> Fog
                            </button>
                            <button
                                className={tool === 'clearFog' ? 'active' : ''}
                                onClick={() => setTool(tool === 'clearFog' ? 'none' : 'clearFog')}
                            >
                                <i className="fa-solid fa-sun"></i> Clear Fog
                            </button>
                        </>
                    )}
                    {isLocalhost && (
                        <button onClick={() => setItemsPanelOpen(prev => !prev)}>
                            <i className="fa-solid fa-box"></i> Items
                        </button>
                    )}
                    <button onClick={zoomIn}>
                        <i className="fa-solid fa-magnifying-glass-plus"></i>
                    </button>
                    <button onClick={zoomOut}>
                        <i className="fa-solid fa-magnifying-glass-minus"></i>
                    </button>
                    <button onClick={resetView}>
                        <i className="fa-solid fa-rotate-left"></i> Reset View
                    </button>
                </div>
            </div>
            <Subscriber handleEvent={handleSSEEvent} />
            <svg
                ref={svgRef}
                viewBox={`${panX} ${panY} ${SVG_SIZE / zoom} ${SVG_SIZE / zoom}`}
                className="grid-svg"
                onPointerDown={handlePanStart}
                onPointerMove={(e) => { handlePointerMove(e); handleGridPointerMove(e); handleFogPointerMove(e); handlePanMove(e); }}
                onPointerUp={(e) => { handlePointerUp(e); handleGridPointerUp(e); handleFogPointerUp(e); handlePanEnd(e); }}
                onPointerLeave={(e) => { handleGridPointerLeave(e); handleFogPointerUp(); }}
                onWheel={handleWheel}
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
                    repositioningItemId={repositioningItemId}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    setSelectedBarrel={setSelectedBarrel}
                    npcImages={npcImages}
                />

                <FogOverlay
                    fog={fog}
                    isLocalhost={isLocalhost}
                    fogDragStart={fogDragStart}
                    fogDragEnd={fogDragEnd}
                />

                {/* Item context menu */}
                {selectedBarrel && (
                    <g className="barrel-context-menu" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                            const menuX = gridCenterX(selectedBarrel.gridX) + 10;
                            const menuY = gridCenterY(selectedBarrel.gridY) + 10;
                            return (
                                <g>
                                    {(() => {
                                        const selectedItem = placedItems.find(i => i.id === selectedBarrel.id);
                                        const isNpc = selectedItem && selectedItem.type === 'npc';
                                        const hasRotation = selectedItem && (selectedItem.type === 'table' || selectedItem.type === 'bed' || selectedItem.type === 'door' || selectedItem.type === 'secretDoor' || selectedItem.type === 'stairs');
                                        const showRenameOption = isNpc;
                                        const hasExtra = showRenameOption || hasRotation;
                                        const menuHeight = hasExtra ? 102 : 80;
                                        return (
                                            <g>
                                                <rect x={menuX} y={menuY} width="120" height={menuHeight} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                                                {/* Show/Hide */}
                                                <text x={menuX + 8} y={menuY + 20} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleToggleItemVisibility(selectedBarrel.id)}>
                                                    {selectedItem?.visible !== false ? 'Hide' : 'Show'}
                                                </text>
                                                {/* Delete */}
                                                <text x={menuX + 8} y={menuY + 42} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleDeleteItem(selectedBarrel.id)}>Delete</text>
                                                {/* Reposition */}
                                                <text x={menuX + 8} y={menuY + 64} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleRepositionItem(selectedBarrel.id)}>Reposition</text>
                                                {/* Rename (NPC only) */}
                                                {showRenameOption && (
                                                    <>
                                                        <text x={menuX + 8} y={menuY + 86} fill="#ccc" fontSize="11" className="menu-option" onClick={() => setShowRename(selectedBarrel.id)}>
                                                            Rename
                                                        </text>
                                                        {showRename === selectedBarrel.id ? (
                                                            <foreignObject x={menuX + 4} y={menuY + 94} width="112" height="28">
                                                                <input
                                                                    type="text"
                                                                    defaultValue={selectedItem?.name || 'NPC'}
                                                                    className="context-menu-input"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            handleRenameItem(selectedBarrel.id, e.target.value);
                                                                        }
                                                                    }}
                                                                    onBlur={(e) => {
                                                                        handleRenameItem(selectedBarrel.id, e.target.value);
                                                                    }}
                                                                    autoFocus
                                                                />
                                                            </foreignObject>
                                                        ) : null}
                                                    </>
                                                )}
                                                {/* Rotate (rotatable items only) */}
                                                {hasRotation && (
                                                    <text x={menuX + 8} y={menuY + 86} fill="#ccc" fontSize="11" className="menu-option" onClick={() => {
                                                        if (selectedItem.type === 'table') handleRotateTable(selectedBarrel.id);
                                                        else if (selectedItem.type === 'bed') handleRotateBed(selectedBarrel.id);
                                                        else if (selectedItem.type === 'door') handleRotateDoor(selectedBarrel.id);
                                                        else if (selectedItem.type === 'secretDoor') handleRotateSecretDoor(selectedBarrel.id);
                                                        else if (selectedItem.type === 'stairs') handleRotateStairs(selectedBarrel.id);
                                                    }}>
                                                        Rotate
                                                    </text>
                                                )}
                                                <text x={menuX + 108} y={menuY + 12} fill="#999" fontSize="10" className="menu-close" onClick={() => { setSelectedBarrel(null); setShowRename(null); }}>✕</text>
                                            </g>
                                        );
                                    })()}
                                </g>
                            );
                        })()}
                    </g>
                )}
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
