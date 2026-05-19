import React, { useState, useEffect, useCallback, useRef } from 'react';
import utils from '../../services/utils.js';
import * as mapsService from '../../services/mapsService.js';
import Subscriber from '../common/Subscriber.jsx';
import './Map.css';
import BarrelSVG from './BarrelSVG.jsx';
import TableSVG from './TableSVG.jsx';
import BedSVG from './BedSVG.jsx';
import FirePitSVG from './FirePitSVG.jsx';
import DoorSVG from './DoorSVG.jsx';
import SecretDoorSVG from './SecretDoorSVG.jsx';
import TrapSVG from './TrapSVG.jsx';
import PillarSVG from './PillarSVG.jsx';
import StairsSVG from './StairsSVG.jsx';

const CELL_SIZE = 40;
const RADIUS = 20;

function Map({ campaignName, characters, isLocalhost, mapName, onBack }) {
    const [gridSize, setGridSize] = useState(13);
    const SVG_SIZE = gridSize * CELL_SIZE;
    const [positioningData, setPositioningData] = useState(null);
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
    // Reposition mode state
    const [repositioningId, setRepositioningId] = useState(null);

    // Load or initialize positioning data on mount
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
                    setPositioningData({ ...existing, walls });
                    setGridSize(existing.gridSize || 13);
                    setPlacedItems(existing.placedItems || []);

                    // Convert existing.doors (from dungeon generator) into placedItems
                    if (existing.doors && existing.doors.length > 0) {
                        setPlacedItems(prev => {
                            const existingDoorKeys = new Set(
                                (prev || []).filter(item => item.type === 'door').map(item => `${item.gridX},${item.gridY}`)
                            );
                            const newDoors = existing.doors.filter(d => !existingDoorKeys.has(`${d.gridX},${d.gridY}`));
                            if (newDoors.length === 0) return prev;
                            return [
                                ...(prev || []),
                                ...newDoors.map(d => ({
                                    gridX: d.gridX,
                                    gridY: d.gridY,
                                    type: d.type || 'door',
                                    id: `door-${d.gridX}-${d.gridY}`,
                                    visible: d.visible !== undefined ? d.visible : true,
                                    rotation: d.rotation || 0
                                }))
                            ];
                        });
                    }

                    // Load fog data: if no fog data or empty array, fog all cells
                    if (!existing.fog || existing.fog.length === 0) {
                        const gs = existing.gridSize || 13;
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
                        const gs = existing.gridSize || 13;
                        const initialCreatures = characters.map((character, i) => ({
                            id: character.id || `creature-${i}-${Date.now()}`,
                            name: character.name || 'Unknown',
                            gridX: Math.min(1 + (i * 2) % gs, gs - 1),
                            gridY: Math.min(1 + Math.floor((i * 2) / gs), gs - 1),
                            imagePath: character.imagePath || ''
                        }));
                        setPositioningData(prev => ({ ...prev, creatures: initialCreatures }));
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

            setPositioningData(newData);
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

    // Save positioning data whenever it changes
    useEffect(() => {
        if (!positioningData) return;
        // Convert walls Set to array for storage
        const dataToSave = {
            ...positioningData,
            gridSize,
            walls: Array.from(positioningData.walls || []),
            placedItems: placedItems,
            fog: Array.from(fog || [])
        };
        mapsService.saveMapData(campaignName, mapName, dataToSave).catch(err => console.error('Failed to save map data:', err));
    }, [positioningData, campaignName, gridSize, placedItems, mapName, fog]);

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
        setPositioningData((prev) => ({
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
    }, [fogDragStart, tool, getGridFromEvent, isLocalhost]);

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
    }, [fogDragStart, fogDragEnd, tool]);

    // Handle grid pointer down (paint/erase mode)
    const handleGridPointerDown = useCallback((e) => {
        if (!isLocalhost) return;
        if (tool === 'none' && !repositioningId) return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;

        // Reposition mode: move the barrel to the clicked grid square
        if (repositioningId) {
            const barrel = placedItems.find(item => item.id === repositioningId);
            if (barrel) {
                setPlacedItems(prev =>
                    prev.map(item =>
                        item.id === repositioningId
                            ? { ...item, gridX: grid.gridX, gridY: grid.gridY }
                            : item
                    )
                );
            }
            setRepositioningId(null);
            return;
        }

        const key = `${grid.gridX},${grid.gridY}`;
        setPositioningData((prev) => {
            const newWalls = new Set(prev.walls);
            if (tool === 'paint') {
                newWalls.add(key);
            } else if (tool === 'erase') {
                newWalls.delete(key);
            }
            return { ...prev, walls: newWalls };
        });
        setPainting(grid);
    }, [tool, getGridFromEvent, repositioningId, placedItems]);

    // Handle grid pointer move (paint/erase drag)
    const handleGridPointerMove = useCallback((e) => {
        if (!isLocalhost) return;
        if (!painting || (tool !== 'paint' && tool !== 'erase')) return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;

        const key = `${grid.gridX},${grid.gridY}`;
        setPositioningData((prev) => {
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

        const creature = positioningData.creatures.find((c) => c.id === creatureId);
        if (!creature) return;

        const cx = gridCenterX(creature.gridX);
        const cy = gridCenterY(creature.gridY);

        setDragging({
            creatureId,
            offsetX: svgX - cx,
            offsetY: svgY - cy
        });
    }, [positioningData, gridSize, panX, panY]);

    const handlePointerMove = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;

        const creature = positioningData.creatures.find((c) => c.id === dragging.creatureId);
        if (!creature) return;

        const cx = svgX - dragging.offsetX;
        const cy = svgY - dragging.offsetY;

        const gridX = Math.floor(cx / CELL_SIZE);
        const gridY = Math.floor(cy / CELL_SIZE);

        const clampedGridX = Math.max(0, Math.min(gridSize - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(gridSize - 1, gridY));

        setPositioningData((prev) => ({
            ...prev,
            creatures: prev.creatures.map((c) =>
                c.id === dragging.creatureId ? { ...c, gridX: clampedGridX, gridY: clampedGridY } : c
            )
        }));
    }, [dragging, positioningData, gridSize, panX, panY]);

    const handlePointerUp = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;

        const creature = positioningData.creatures.find((c) => c.id === dragging.creatureId);
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
            positioningData.creatures
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

        setPositioningData((prev) => ({
            ...prev,
            creatures: prev.creatures.map((c) =>
                c.id === dragging.creatureId ? { ...c, gridX: targetX, gridY: targetY } : c
            )
        }));

        setDragging(null);
    }, [dragging, positioningData, gridSize, panX, panY]);

    const handlePointerLeave = useCallback(() => {
        setDragging(null);
    }, []);

    // Clear all walls and reset tool
    const handleClearWalls = useCallback(() => {
        if (window.confirm('Clear all painted walls?')) {
            setPositioningData((prev) => ({ ...prev, walls: new Set() }));
            setTool('none');
        }
    }, []);

    // Handle drop from items panel onto grid
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;
        const itemType = e.dataTransfer.getData('text/plain');
        if (!itemType) return;

        const newItem = {
            id: utils.guid(),
            type: itemType,
            gridX: grid.gridX,
            gridY: grid.gridY,
            visible: isLocalhost,
            rotation: (itemType === 'table' || itemType === 'bed' || itemType === 'stairs') ? 0 : undefined
        };
        setPlacedItems(prev => [...prev, newItem]);
    }, [getGridFromEvent, isLocalhost]);

    // Toggle visibility of a placed item (localhost only)
    const handleToggleItemVisibility = useCallback((itemId) => {
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, visible: !item.visible } : item
            )
        );
    }, []);

    // Delete a placed barrel (localhost only)
    const handleDeleteBarrel = useCallback((itemId) => {
        setPlacedItems(prev => prev.filter(item => item.id !== itemId));
        setSelectedBarrel(null);
    }, []);

    // Enter reposition mode for a barrel
    const handleRepositionBarrel = useCallback((itemId) => {
        setRepositioningId(itemId);
        setSelectedBarrel(null);
    }, []);

    // Rotate a table (0 ↔ 90 degrees)
    const handleRotateTable = useCallback((itemId) => {
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, rotation: (item.rotation || 0) === 0 ? 90 : 0 } : item
            )
        );
        setSelectedBarrel(null);
    }, []);

    // Rotate a bed (0 → 90 → 180 → 270 → 0 degrees)
    const handleRotateBed = useCallback((itemId) => {
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, rotation: ((item.rotation || 0) + 90) % 360 } : item
            )
        );
        setSelectedBarrel(null);
    }, []);

    // Rotate a door (0 → 90 → 180 → 270 → 0 degrees)
    const handleRotateDoor = useCallback((id) => {
        setPlacedItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const currentRotation = item.rotation || 0;
            const newRotation = (currentRotation + 90) % 360;
            return { ...item, rotation: newRotation };
        }));
    }, []);

    // Rotate a secret door (0 → 90 → 180 → 270 → 0 degrees)
    const handleRotateSecretDoor = useCallback((id) => {
        setPlacedItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const currentRotation = item.rotation || 0;
            const newRotation = (currentRotation + 90) % 360;
            return { ...item, rotation: newRotation };
        }));
    }, []);

    // Rotate stairs (0 → 90 → 180 → 270 → 0 degrees)
    const handleRotateStairs = useCallback((id) => {
        setPlacedItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const currentRotation = item.rotation || 0;
            const newRotation = (currentRotation + 90) % 360;
            return { ...item, rotation: newRotation };
        }));
    }, []);

    // Close context menu and reposition mode
    const handleCloseMenu = useCallback(() => {
        setSelectedBarrel(null);
        setRepositioningId(null);
    }, []);

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
        if (repositioningId) {
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
    }, [tool, panX, panY, handleGridPointerDown, repositioningId]);

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

    if (!positioningData) return null;

    const { creatures, walls } = positioningData;

    return (
        <div className="positioning">
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

                {/* Grid background */}
                <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} className="grid-bg" />

                {/* Vertical grid lines */}
                {Array.from({ length: gridSize + 1 }, (_, i) => (
                    <line
                        key={`v-${i}`}
                        x1={i * CELL_SIZE}
                        y1="0"
                        x2={i * CELL_SIZE}
                        y2={SVG_SIZE}
                        className="grid-line"
                    />
                ))}

                {/* Horizontal grid lines */}
                {Array.from({ length: gridSize + 1 }, (_, i) => (
                    <line
                        key={`h-${i}`}
                        x1="0"
                        y1={i * CELL_SIZE}
                        x2={SVG_SIZE}
                        y2={i * CELL_SIZE}
                        className="grid-line"
                    />
                ))}

                {/* Walls */}
                {Array.from(walls).filter(key => isLocalhost || !fog?.has(key)).map((key) => {
                    const [gx, gy] = key.split(',').map(Number);
                    return (
                        <rect
                            key={key}
                            x={gx * CELL_SIZE}
                            y={gy * CELL_SIZE}
                            width={CELL_SIZE}
                            height={CELL_SIZE}
                            className="wall-cell"
                        />
                    );
                })}

                {/* Characters */}
                {creatures.map((creature) => {
                    const cx = gridCenterX(creature.gridX);
                    const cy = gridCenterY(creature.gridY);
                    // Hide creature from players if cell is fogged
                    if (!isLocalhost && fog?.has(`${creature.gridX},${creature.gridY}`)) return null;

                    return (
                        <g
                            key={creature.id}
                            onPointerDown={(e) => handlePointerDown(e, creature.id)}
                            className="creature-group"
                            style={{ cursor: 'grab' }}
                        >
                            <defs>
                                <clipPath id={`creature-clip-${creature.id}`}>
                                    <circle cx={cx} cy={cy} r={RADIUS} />
                                </clipPath>
                            </defs>
                            <circle
                                cx={cx}
                                cy={cy}
                                r={RADIUS}
                                className={`creature-circle ${dragging?.creatureId === creature.id ? 'dragging' : ''}`}
                            />
                            {creature.imagePath ? (
                                <image
                                    xlinkHref={creature.imagePath}
                                    x={cx - RADIUS + 2}
                                    y={cy - RADIUS + 2}
                                    width={RADIUS * 2 - 4}
                                    height={RADIUS * 2 - 4}
                                    preserveAspectRatio="xMidYMid slice"
                                    clipPath={`url(#creature-clip-${creature.id})`}
                                    className="creature-image"
                                />
                            ) : (
                                <text
                                    x={cx}
                                    y={cy}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fill="#fff"
                                    fontSize="16"
                                    fontWeight="bold"
                                    className="creature-initial"
                                >
                                    {creature.name.charAt(0).toUpperCase()}
                                </text>
                            )}
                            <text
                                x={cx}
                                y={cy + RADIUS - 4}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize="8"
                                fontWeight="bold"
                                className="creature-name"
                            >
                                {creature.name}
                            </text>
                        </g>
                    );
                })}

                {/* Placed items (barrels) */}
                {placedItems.filter(item => item.type === 'barrel').map((item) => {
                    const cx = gridCenterX(item.gridX);
                    const cy = gridCenterY(item.gridY);
                    // On non-localhost, hide items marked as not visible
                    if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;

                    const isRepositioning = repositioningId === item.id;

                    return (
                        <g key={item.id} className="placed-item">
                            {/* Centered barrel — offset by half its 36px size */}
                            <use href="#barrel" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                            {isLocalhost && !isRepositioning && (
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={RADIUS}
                                    fill="transparent"
                                    className="barrel-hit-area"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            )}
                            {/* Reposition mode highlight */}
                            {isRepositioning && (
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={RADIUS + 4}
                                    fill="none"
                                    className="reposition-highlight"
                                />
                            )}
                        </g>
                    );
                })}

                {/* Placed items (tables) */}
                {placedItems.filter(item => item.type === 'table').map((item) => {
                    const isRotated = (item.rotation || 0) === 90;
                    const cx = isRotated
                        ? gridCenterX(item.gridX)
                        : gridCenterX(item.gridX) + CELL_SIZE / 2;
                    const cy = isRotated
                        ? gridCenterY(item.gridY) + CELL_SIZE / 2
                        : gridCenterY(item.gridY);
                    // On non-localhost, hide items marked as not visible
                    if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;

                    const isRepositioning = repositioningId === item.id;
                    const tableW = isRotated ? 36 : 72;
                    const tableH = isRotated ? 72 : 36;

                    return (
                        <g key={item.id} className="placed-item">
                            <use
                                href="#table"
                                x={cx - 36}
                                y={cy - 18}
                                opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                                transform={isRotated ? `rotate(90, ${cx}, ${cy})` : undefined}
                            />
                            {isLocalhost && !isRepositioning && (
                                <rect
                                    x={cx - tableW / 2}
                                    y={cy - tableH / 2}
                                    width={tableW}
                                    height={tableH}
                                    fill="transparent"
                                    className="barrel-hit-area"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            )}
                            {isRepositioning && (
                                <rect
                                    x={cx - tableW / 2}
                                    y={cy - tableH / 2}
                                    width={tableW}
                                    height={tableH}
                                    fill="none"
                                    className="reposition-highlight"
                                />
                            )}
                        </g>
                    );
                })}

                {/* Placed items (beds) */}
                {placedItems.filter(item => item.type === 'bed').map((item) => {
                    const isVertical = (item.rotation || 0) % 180 === 90;
                    const cx = isVertical
                        ? gridCenterX(item.gridX)
                        : gridCenterX(item.gridX) + CELL_SIZE / 2;
                    const cy = isVertical
                        ? gridCenterY(item.gridY) + CELL_SIZE / 2
                        : gridCenterY(item.gridY);
                    // On non-localhost, hide items marked as not visible
                    if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;

                    const isRepositioning = repositioningId === item.id;
                    const bedW = isVertical ? 36 : 72;
                    const bedH = isVertical ? 72 : 36;

                    return (
                        <g key={item.id} className="placed-item">
                            <use
                                href="#bed"
                                x={cx - 36}
                                y={cy - 18}
                                opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                                transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined}
                            />
                            {isLocalhost && !isRepositioning && (
                                <rect
                                    x={cx - bedW / 2}
                                    y={cy - bedH / 2}
                                    width={bedW}
                                    height={bedH}
                                    fill="transparent"
                                    className="barrel-hit-area"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            )}
                            {isRepositioning && (
                                <rect
                                    x={cx - bedW / 2}
                                    y={cy - bedH / 2}
                                    width={bedW}
                                    height={bedH}
                                    fill="none"
                                    className="reposition-highlight"
                                />
                            )}
                        </g>
                    );
                })}

                {/* Placed items (fire pits) */}
                {placedItems.filter(item => item.type === 'firepit').map((item) => {
                    const cx = gridCenterX(item.gridX);
                    const cy = gridCenterY(item.gridY);
                    // On non-localhost, hide items marked as not visible
                    if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;

                    const isRepositioning = repositioningId === item.id;

                    return (
                        <g key={item.id} className="placed-item">
                            <use
                                href="#firepit"
                                x={cx - 18}
                                y={cy - 18}
                                opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                            />
                            {isLocalhost && !isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="transparent"
                                    className="barrel-hit-area"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            )}
                            {isRepositioning && (
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={18}
                                    fill="none"
                                    className="reposition-highlight"
                                />
                            )}
                        </g>
                    );
                })}

                {/* Placed items (doors) */}
                {placedItems.filter(item => item.type === 'door').map((item) => {
                    const cx = gridCenterX(item.gridX);
                    const cy = gridCenterY(item.gridY);
                    // On non-localhost, hide items marked as not visible
                    if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;

                    const isRepositioning = repositioningId === item.id;

                    return (
                        <g key={item.id} className="placed-item">
                            <use
                                href="#door"
                                x={cx - 18}
                                y={cy - 18}
                                opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                                transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined}
                            />
                            {isLocalhost && !isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="transparent"
                                    className="barrel-hit-area"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            )}
                            {isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="none"
                                    className="reposition-highlight"
                                />
                            )}
                        </g>
                    );
                })}

                {/* Placed items (secret doors) */}
                {placedItems.filter(item => item.type === 'secretDoor').map((item) => {
                    const cx = gridCenterX(item.gridX);
                    const cy = gridCenterY(item.gridY);
                    // On non-localhost, hide items marked as not visible
                    if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;

                    const isRepositioning = repositioningId === item.id;

                    return (
                        <g key={item.id} className="placed-item">
                            <use
                                href="#secretDoor"
                                x={cx - 18}
                                y={cy - 18}
                                opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                                transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined}
                            />
                            {isLocalhost && !isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="transparent"
                                    className="barrel-hit-area"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            )}
                            {isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="none"
                                    className="reposition-highlight"
                                />
                            )}
                        </g>
                    );
                })}

                {/* Placed items (traps) */}
                {placedItems.filter(item => item.type === 'trap').map((item) => {
                    const cx = gridCenterX(item.gridX);
                    const cy = gridCenterY(item.gridY);
                    // On non-localhost, hide items marked as not visible
                    if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;

                    const isRepositioning = repositioningId === item.id;

                    return (
                        <g key={item.id} className="placed-item">
                            <use
                                href="#trap"
                                x={cx - 18}
                                y={cy - 18}
                                opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                            />
                            {isLocalhost && !isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="transparent"
                                    className="barrel-hit-area"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            )}
                            {isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="none"
                                    className="reposition-highlight"
                                />
                            )}
                        </g>
                    );
                })}

                {/* Placed items (pillars) */}
                {placedItems.filter(item => item.type === 'pillar').map((item) => {
                    const cx = gridCenterX(item.gridX);
                    const cy = gridCenterY(item.gridY);
                    // On non-localhost, hide items marked as not visible
                    if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;

                    const isRepositioning = repositioningId === item.id;

                    return (
                        <g key={item.id} className="placed-item">
                            <use
                                href="#pillar"
                                x={cx - 18}
                                y={cy - 18}
                                opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                            />
                            {isLocalhost && !isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="transparent"
                                    className="barrel-hit-area"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            )}
                            {isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="none"
                                    className="reposition-highlight"
                                />
                            )}
                        </g>
                    );
                })}

                {/* Placed items (stairs) */}
                {placedItems.filter(item => item.type === 'stairs').map((item) => {
                    const cx = gridCenterX(item.gridX);
                    const cy = gridCenterY(item.gridY);
                    // On non-localhost, hide items marked as not visible
                    if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;

                    const isRepositioning = repositioningId === item.id;

                    return (
                        <g key={item.id} className="placed-item">
                            <use
                                href="#stairs"
                                x={cx - 18}
                                y={cy - 18}
                                opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                                transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined}
                            />
                            {isLocalhost && !isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="transparent"
                                    className="barrel-hit-area"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY });
                                    }}
                                    style={{ cursor: 'pointer' }}
                                />
                            )}
                            {isRepositioning && (
                                <rect
                                    x={cx - 18}
                                    y={cy - 18}
                                    width={36}
                                    height={36}
                                    fill="none"
                                    className="reposition-highlight"
                                />
                            )}
                        </g>
                    );
                })}

                {/* Fog of War overlay — GM sees subtle fog, players see nothing here (filtered below) */}
                {isLocalhost && fog && Array.from(fog).map((key) => {
                    const [gx, gy] = key.split(',').map(Number);
                    return (
                        <rect
                            key={`fog-${key}`}
                            x={gx * CELL_SIZE}
                            y={gy * CELL_SIZE}
                            width={CELL_SIZE}
                            height={CELL_SIZE}
                            className="fog-cell"
                        />
                    );
                })}

                {/* Fog drag selection rectangle preview */}
                {isLocalhost && fogDragStart && fogDragEnd && (fogDragStart.gridX !== fogDragEnd.gridX || fogDragStart.gridY !== fogDragEnd.gridY) && (() => {
                    const minX = Math.min(fogDragStart.gridX, fogDragEnd.gridX);
                    const maxX = Math.max(fogDragStart.gridX, fogDragEnd.gridX);
                    const minY = Math.min(fogDragStart.gridY, fogDragEnd.gridY);
                    const maxY = Math.max(fogDragStart.gridY, fogDragEnd.gridY);
                    return (
                        <rect
                            x={minX * CELL_SIZE}
                            y={minY * CELL_SIZE}
                            width={(maxX - minX + 1) * CELL_SIZE}
                            height={(maxY - minY + 1) * CELL_SIZE}
                            className="fog-preview"
                        />
                    );
                })()}

                {/* Barrel context menu */}
                {selectedBarrel && (
                    <g className="barrel-context-menu" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                            const menuX = gridCenterX(selectedBarrel.gridX) + 10;
                            const menuY = gridCenterY(selectedBarrel.gridY) + 10;
                            return (
                                <g>
                                    {(() => {
                                        const selectedItem = placedItems.find(i => i.id === selectedBarrel.id);
                                        const hasRotation = selectedItem && (selectedItem.type === 'table' || selectedItem.type === 'bed' || selectedItem.type === 'door' || selectedItem.type === 'secretDoor' || selectedItem.type === 'stairs');
                                        const menuHeight = hasRotation ? 120 : 100;
                                        const repositionY = hasRotation ? menuY + 86 : menuY + 64;
                                        return (
                                            <g>
                                                <rect x={menuX} y={menuY} width="120" height={menuHeight} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                                                {(() => {
                                                    const barrel = placedItems.find(i => i.id === selectedBarrel.id);
                                                    const isVisible = barrel ? barrel.visible : true;
                                                    return (
                                                        <text x={menuX + 8} y={menuY + 20} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleToggleItemVisibility(selectedBarrel.id)}>
                                                            {isVisible ? 'Hide' : 'Show'}
                                                        </text>
                                                    );
                                                })()}
                                                <text x={menuX + 8} y={menuY + 42} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleDeleteBarrel(selectedBarrel.id)}>Delete</text>
                                                {hasRotation && (
                                                    <text x={menuX + 8} y={menuY + 64} fill="#ccc" fontSize="11" className="menu-option" onClick={() => {
                                                        if (selectedItem.type === 'table') handleRotateTable(selectedBarrel.id);
                                                        else if (selectedItem.type === 'bed') handleRotateBed(selectedBarrel.id);
                                                        else if (selectedItem.type === 'door') handleRotateDoor(selectedBarrel.id);
                                                        else if (selectedItem.type === 'secretDoor') handleRotateSecretDoor(selectedBarrel.id);
                                                        else if (selectedItem.type === 'stairs') handleRotateStairs(selectedBarrel.id);
                                                    }}>
                                                        Rotate
                                                    </text>
                                                )}
                                                <text x={menuX + 8} y={repositionY} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleRepositionBarrel(selectedBarrel.id)}>Reposition</text>
                                                <text x={menuX + 108} y={menuY + 12} fill="#999" fontSize="10" className="menu-close" onClick={() => setSelectedBarrel(null)}>✕</text>
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
                <div className="items-panel">
                    <button className="items-panel-close" onClick={() => setItemsPanelOpen(false)}>
                        <i className="fa-solid fa-times"></i>
                    </button>
                    <div className="items-panel-content">
                        <div
                            className="items-panel-item"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', 'barrel');
                            }}
                        >
                            <svg viewBox="0 0 36 36" width="36" height="36">
                                <BarrelSVG />
                            </svg>
                            <span>Barrel</span>
                        </div>
                        <div
                            className="items-panel-item"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', 'bed');
                            }}
                        >
                            <svg viewBox="0 0 72 36" width="72" height="36">
                                <BedSVG />
                            </svg>
                            <span>Bed</span>
                        </div>
                        <div
                            className="items-panel-item"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', 'door');
                            }}
                        >
                            <svg viewBox="0 0 36 36" width="36" height="36">
                                <DoorSVG />
                            </svg>
                            <span>Door</span>
                        </div>
                        <div
                            className="items-panel-item"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', 'firepit');
                            }}
                        >
                            <svg viewBox="0 0 36 36" width="36" height="36">
                                <FirePitSVG />
                            </svg>
                            <span>Fire Pit</span>
                        </div>
                        <div
                            className="items-panel-item"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', 'pillar');
                            }}
                        >
                            <svg viewBox="0 0 36 36" width="36" height="36">
                                <PillarSVG />
                            </svg>
                            <span>Pillar</span>
                        </div>
                        <div
                            className="items-panel-item"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', 'secretDoor');
                            }}
                        >
                            <svg viewBox="0 0 36 36" width="36" height="36">
                                <SecretDoorSVG />
                            </svg>
                            <span>Secret Door</span>
                        </div>
                        <div
                            className="items-panel-item"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', 'stairs');
                            }}
                        >
                            <svg viewBox="0 0 36 36" width="36" height="36">
                                <StairsSVG />
                            </svg>
                            <span>Stairs</span>
                        </div>
                        <div
                            className="items-panel-item"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', 'table');
                            }}
                        >
                            <svg viewBox="0 0 72 36" width="72" height="36">
                                <TableSVG />
                            </svg>
                            <span>Table</span>
                        </div>
                        <div
                            className="items-panel-item"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', 'trap');
                            }}
                        >
                            <svg viewBox="0 0 36 36" width="36" height="36">
                                <TrapSVG />
                            </svg>
                            <span>Trap</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Map;
