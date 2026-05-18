import React, { useState, useEffect, useCallback, useRef } from 'react';
import utils from '../../services/utils.js';
import storage from '../../services/storage.js';
import Subscriber from '../common/Subscriber.jsx';
import './Positioning.css';

const GRID_SIZE = 13;
const CELL_SIZE = 40;
const SVG_SIZE = GRID_SIZE * CELL_SIZE; // 520
const RADIUS = 20;

function Positioning({ campaignName, characters }) {
    const [positioningData, setPositioningData] = useState(null);
    const svgRef = useRef(null);
    const isInitialized = useRef(false);

    // Load or initialize positioning data on mount
    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

        const existing = storage.get('positioning-' + campaignName);
        if (existing && existing.creatures && existing.creatures.length > 0) {
            setPositioningData(existing);
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
                gridX = Math.floor(Math.random() * GRID_SIZE); // 0–12
                gridY = Math.floor(Math.random() * GRID_SIZE); // 0–12
                key = `${gridX},${gridY}`;
            } while (occupied.has(key));
            occupied.add(key);
            creature.gridX = gridX;
            creature.gridY = gridY;
        });

        const newData = { creatures };
        setPositioningData(newData);
        storage.set('positioning-' + campaignName, newData);
    }, [campaignName, characters]);

    // Save positioning data whenever it changes
    useEffect(() => {
        if (!positioningData) return;
        storage.set('positioning-' + campaignName, positioningData);
    }, [positioningData, campaignName]);

    // SSE handler for real-time updates from other clients
    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.creatures) return;
        setPositioningData({ creatures: event.creatures });
    }, []);

    // Calculate center of a grid square
    const gridCenterX = useCallback((gridX) => gridX * CELL_SIZE + CELL_SIZE / 2, []);
    const gridCenterY = useCallback((gridY) => gridY * CELL_SIZE + CELL_SIZE / 2, []);

    // Drag state
    const [dragging, setDragging] = useState(null); // { creatureId, offsetX, offsetY }

    const handlePointerDown = useCallback((e, creatureId) => {
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const svgX = (e.clientX - rect.left) / rect.width * SVG_SIZE;
        const svgY = (e.clientY - rect.top) / rect.height * SVG_SIZE;

        const creature = positioningData.creatures.find((c) => c.id === creatureId);
        if (!creature) return;

        const cx = gridCenterX(creature.gridX);
        const cy = gridCenterY(creature.gridY);

        setDragging({
            creatureId,
            offsetX: svgX - cx,
            offsetY: svgY - cy
        });
    }, [positioningData]);

    const handlePointerMove = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const svgX = (e.clientX - rect.left) / rect.width * SVG_SIZE;
        const svgY = (e.clientY - rect.top) / rect.height * SVG_SIZE;

        const creature = positioningData.creatures.find((c) => c.id === dragging.creatureId);
        if (!creature) return;

        const cx = svgX - dragging.offsetX;
        const cy = svgY - dragging.offsetY;

        const gridX = Math.floor(cx / CELL_SIZE);
        const gridY = Math.floor(cy / CELL_SIZE);

        const clampedGridX = Math.max(0, Math.min(GRID_SIZE - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(GRID_SIZE - 1, gridY));

        setPositioningData((prev) => ({
            ...prev,
            creatures: prev.creatures.map((c) =>
                c.id === dragging.creatureId ? { ...c, gridX: clampedGridX, gridY: clampedGridY } : c
            )
        }));
    }, [dragging, positioningData]);

    const handlePointerUp = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const svgX = (e.clientX - rect.left) / rect.width * SVG_SIZE;
        const svgY = (e.clientY - rect.top) / rect.height * SVG_SIZE;

        const creature = positioningData.creatures.find((c) => c.id === dragging.creatureId);
        if (!creature) {
            setDragging(null);
            return;
        }

        const cx = svgX - dragging.offsetX;
        const cy = svgY - dragging.offsetY;

        const gridX = Math.floor(cx / CELL_SIZE);
        const gridY = Math.floor(cy / CELL_SIZE);

        const clampedGridX = Math.max(0, Math.min(GRID_SIZE - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(GRID_SIZE - 1, gridY));

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
                    const clampedNx = Math.max(0, Math.min(GRID_SIZE - 1, nx));
                    const clampedNy = Math.max(0, Math.min(GRID_SIZE - 1, ny));
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
    }, [dragging, positioningData]);

    const handlePointerLeave = useCallback(() => {
        setDragging(null);
    }, []);

    if (!positioningData) return null;

    const { creatures } = positioningData;

    return (
        <div className="positioning">
            <h4>Positioning</h4>
            <Subscriber handleEvent={handleSSEEvent} />
            <svg
                ref={svgRef}
                viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                className="grid-svg"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
            >
                {/* Grid background */}
                <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} fill="#f5f5f5" />

                {/* Vertical grid lines */}
                {Array.from({ length: GRID_SIZE + 1 }, (_, i) => (
                    <line
                        key={`v-${i}`}
                        x1={i * CELL_SIZE}
                        y1="0"
                        x2={i * CELL_SIZE}
                        y2={SVG_SIZE}
                        stroke="#d0d0d0"
                        strokeWidth="1"
                    />
                ))}

                {/* Horizontal grid lines */}
                {Array.from({ length: GRID_SIZE + 1 }, (_, i) => (
                    <line
                        key={`h-${i}`}
                        x1="0"
                        y1={i * CELL_SIZE}
                        x2={SVG_SIZE}
                        y2={i * CELL_SIZE}
                        stroke="#d0d0d0"
                        strokeWidth="1"
                    />
                ))}

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
                            <circle
                                cx={cx}
                                cy={cy}
                                r={RADIUS}
                                fill={dragging?.creatureId === creature.id ? '#ff6b6b' : '#4a90d9'}
                                stroke={dragging?.creatureId === creature.id ? '#c0392b' : '#2c5f8a'}
                                strokeWidth={dragging?.creatureId === creature.id ? 3 : 2}
                                className="creature-circle"
                            />
                            {creature.imagePath ? (
                                <image
                                    xlinkHref={creature.imagePath}
                                    x={cx - RADIUS + 2}
                                    y={cy - RADIUS + 2}
                                    width={RADIUS * 2 - 4}
                                    height={RADIUS * 2 - 4}
                                    preserveAspectRatio="xMidYMid slice"
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
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

export default Positioning;
