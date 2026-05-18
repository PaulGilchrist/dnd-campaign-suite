import React, { useState, useEffect, useCallback, useRef } from 'react';
import utils from '../../services/utils.js';
import storage from '../../services/storage.js';
import Subscriber from '../common/Subscriber.jsx';
import './Positioning.css';
import BarrelSVG from './BarrelSVG.jsx';
import TableSVG from './TableSVG.jsx';

const CELL_SIZE = 40;
const RADIUS = 20;

function Positioning({ campaignName, characters, isLocalhost }) {
    const [gridSize, setGridSize] = useState(13);
    const SVG_SIZE = gridSize * CELL_SIZE;
    const [positioningData, setPositioningData] = useState(null);
    const svgRef = useRef(null);
    const isInitialized = useRef(false);

    // Tool state: 'none' | 'paint' | 'erase'
    const [tool, setTool] = useState('none');
    // Paint state: tracks grid coords during active paint/erase
    const [painting, setPainting] = useState(null);
    // Drag state
    const [dragging, setDragging] = useState(null); // { creatureId, offsetX, offsetY }

    // Zoom/Pan state
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [panning, setPanning] = useState(null); // { startX, startY, startPanX, startPanY }

    // Items panel state
    const [itemsPanelOpen, setItemsPanelOpen] = useState(false);
    const [placedItems, setPlacedItems] = useState([]);

    // Barrel context menu state
    const [selectedBarrel, setSelectedBarrel] = useState(null); // { id, gridX, gridY }
    // Reposition mode state
    const [repositioningId, setRepositioningId] = useState(null);

    // Load or initialize positioning data on mount
    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

        const existing = storage.get('positioning-' + campaignName);
        if (existing && existing.creatures && existing.creatures.length > 0) {
            // Convert stored walls array back to Set
            const walls = existing.walls
                ? new Set(existing.walls)
                : new Set();
            setPositioningData({ ...existing, walls });
            setGridSize(existing.gridSize || 13);
            if (existing.placedItems) {
                setPlacedItems(existing.placedItems);
            }
            return;
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
        setPositioningData(newData);
        storage.set('positioning-' + campaignName, newData);
    }, [campaignName, characters]);

    // Save positioning data whenever it changes
    useEffect(() => {
        if (!positioningData) return;
        // Convert walls Set to array for storage
        const dataToSave = {
            ...positioningData,
            gridSize,
            walls: Array.from(positioningData.walls || []),
            placedItems: placedItems
        };
        storage.set('positioning-' + campaignName, dataToSave);
    }, [positioningData, campaignName, gridSize, placedItems]);

    // SSE handler for real-time updates from other clients
    const handleSSEEvent = useCallback((event) => {
        if (!event) return;
        if (event.gridSize !== undefined) {
            setGridSize(event.gridSize);
        }
        setPositioningData((prev) => ({
            creatures: event.creatures || prev?.creatures,
            walls: event.walls ? new Set(event.walls) : prev?.walls
        }));
        if (event.placedItems !== undefined) {
            setPlacedItems(event.placedItems);
        }
    }, []);

    // Calculate center of a grid square
    const gridCenterX = useCallback((gridX) => gridX * CELL_SIZE + CELL_SIZE / 2, []);
    const gridCenterY = useCallback((gridY) => gridY * CELL_SIZE + CELL_SIZE / 2, []);

    // Convert SVG pointer position to grid coordinates
    const getGridFromEvent = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg) return null;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;

        const gridX = Math.max(0, Math.min(gridSize - 1, Math.floor(svgX / CELL_SIZE)));
        const gridY = Math.max(0, Math.min(gridSize - 1, Math.floor(svgY / CELL_SIZE)));

        return { gridX, gridY };
    }, [gridSize]);

    // Handle grid pointer down (paint/erase mode)
    const handleGridPointerDown = useCallback((e) => {
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
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;

        const creature = positioningData.creatures.find((c) => c.id === creatureId);
        if (!creature) return;

        const cx = gridCenterX(creature.gridX);
        const cy = gridCenterY(creature.gridY);

        setDragging({
            creatureId,
            offsetX: svgX - cx,
            offsetY: svgY - cy
        });
    }, [positioningData, gridSize]);

    const handlePointerMove = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;

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
    }, [dragging, positioningData, gridSize]);

    const handlePointerUp = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;

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
    }, [dragging, positioningData, gridSize]);

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
            rotation: itemType === 'table' ? 0 : undefined
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

    // Close context menu and reposition mode
    const handleCloseMenu = useCallback(() => {
        setSelectedBarrel(null);
        setRepositioningId(null);
    }, []);

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
        if (!e.shiftKey) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;

        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));

        // Adjust pan so the point under the cursor stays in place
        const newPanX = svgX - (svgX - panX) * (zoom / newZoom);
        const newPanY = svgY - (svgY - panY) * (zoom / newZoom);

        setZoom(newZoom);
        setPanX(newPanX);
        setPanY(newPanY);
    }, [zoom, panX, panY]);

    if (!positioningData) return null;

    const { creatures, walls } = positioningData;

    return (
        <div className="positioning">
            <div className="toolbar-row">
                <h4>Positioning / Marching Order</h4>
                <label className="grid-size-label">
                    Grid Size&nbsp;&nbsp;
                    <input
                        type="number"
                        min="5"
                        max="25"
                        value={gridSize}
                        onChange={(e) => setGridSize(Number(e.target.value))}
                        className="grid-size-input"
                    />
                </label>
                <div className="toolbar">
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
                    <button onClick={() => setItemsPanelOpen(prev => !prev)}>
                        <i className="fa-solid fa-box"></i> Items
                    </button>
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
                onPointerMove={(e) => { handlePointerMove(e); handleGridPointerMove(e); handlePanMove(e); }}
                onPointerUp={(e) => { handlePointerUp(e); handleGridPointerUp(e); handlePanEnd(e); }}
                onPointerLeave={handleGridPointerLeave}
                onWheel={handleWheel}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={handleCloseMenu}
                style={{ cursor: panning ? 'grabbing' : (tool === 'none' ? 'grab' : 'default') }}
            >
                <defs>
                    <BarrelSVG id="barrel" />
                    <TableSVG id="table" />
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
                {Array.from(walls).map((key) => {
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
                    if (!isLocalhost && !item.visible) return null;

                    const isRepositioning = repositioningId === item.id;

                    return (
                        <g key={item.id} className="placed-item">
                            {/* Centered barrel — offset by half its 36px size */}
                            <use href="#barrel" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.3) : 1} />
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
                    if (!isLocalhost && !item.visible) return null;

                    const isRepositioning = repositioningId === item.id;
                    const tableW = isRotated ? 36 : 72;
                    const tableH = isRotated ? 72 : 36;

                    return (
                        <g key={item.id} className="placed-item">
                            <use
                                href="#table"
                                x={cx - 36}
                                y={cy - 18}
                                opacity={isLocalhost ? (item.visible ? 1 : 0.3) : 1}
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

                {/* Barrel context menu */}
                {selectedBarrel && (
                    <g className="barrel-context-menu" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                            const menuX = gridCenterX(selectedBarrel.gridX) + 10;
                            const menuY = gridCenterY(selectedBarrel.gridY) + 10;
                            return (
                                <g>
                                    <rect x={menuX} y={menuY} width="120" height="120" rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
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
                                    {(() => {
                                        const selectedItem = placedItems.find(i => i.id === selectedBarrel.id);
                                        if (selectedItem && selectedItem.type === 'table') {
                                            return (
                                                <text x={menuX + 8} y={menuY + 64} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleRotateTable(selectedBarrel.id)}>
                                                    Rotate {(selectedItem.rotation || 0) === 0 ? '90°' : '0°'}
                                                </text>
                                            );
                                        }
                                        return null;
                                    })()}
                                    <text x={menuX + 8} y={menuY + 86} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleRepositionBarrel(selectedBarrel.id)}>Reposition</text>
                                    <text x={menuX + 108} y={menuY + 12} fill="#999" fontSize="10" className="menu-close" onClick={() => setSelectedBarrel(null)}>✕</text>
                                </g>
                            );
                        })()}
                    </g>
                )}
            </svg>

            {/* Items panel sidebar */}
            {itemsPanelOpen && (
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
                                e.dataTransfer.setData('text/plain', 'table');
                            }}
                        >
                            <svg viewBox="0 0 72 36" width="72" height="36">
                                <TableSVG />
                            </svg>
                            <span>Table</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Positioning;
