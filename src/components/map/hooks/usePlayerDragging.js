import { useState, useCallback } from 'react';
import { CELL_SIZE } from '../../../config/mapConfig';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function toSvgPoint(svg, clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
}

function clampToGrid(v, gridSize) {
    return Math.max(0, Math.min(gridSize - 1, v));
}

function findFreeSquare(startX, startY, occupiedSquares, gridSize) {
    if (!occupiedSquares.has(`${startX},${startY}`)) {
        return { targetX: startX, targetY: startY };
    }

    const visited = new Set([`${startX},${startY}`]);
    const queue = [[startX, startY]];

    while (queue.length > 0) {
        const [x, y] = queue.shift();
        if (!occupiedSquares.has(`${x},${y}`)) {
            return { targetX: x, targetY: y };
        }
        const neighbors = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
        ];
        for (const [nx, ny] of neighbors) {
            const clampedNx = clampToGrid(nx, gridSize);
            const clampedNy = clampToGrid(ny, gridSize);
            const clampedKey = `${clampedNx},${clampedNy}`;
            if (!visited.has(clampedKey) && !occupiedSquares.has(clampedKey)) {
                visited.add(clampedKey);
                queue.push([clampedNx, clampedNy]);
            }
        }
    }

    return { targetX: startX, targetY: startY };
}

export default function usePlayerDragging({
    svgRef,
    mapData,
    gridSize,
    setMapData,
    gridCenterX,
    gridCenterY,
    rulerMode,
    spellMode,
    campaignName,
}) {
    const [dragging, setDragging] = useState(null);

    const handlePointerDown = useCallback((e, playerId) => {
        if (rulerMode || spellMode) return;
        e.stopPropagation();
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        svg.setPointerCapture(e.pointerId);

        const svgPt = toSvgPoint(svg, e.clientX, e.clientY);
        if (!svgPt) return;

        const player = mapData.players.find((c) => c.id === playerId);
        if (!player) return;

        const cx = gridCenterX(player.gridX);
        const cy = gridCenterY(player.gridY);

        setDragging({
            playerId,
            pointerId: e.pointerId,
            offsetX: svgPt.x - cx,
            offsetY: svgPt.y - cy
        });
    }, [rulerMode, spellMode, mapData, gridCenterX, gridCenterY, svgRef]);

    const handlePointerMove = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const svgPt = toSvgPoint(svg, e.clientX, e.clientY);
        if (!svgPt) return;

        const player = mapData.players.find((c) => c.id === dragging.playerId);
        if (!player) return;

        const cx = svgPt.x - dragging.offsetX;
        const cy = svgPt.y - dragging.offsetY;

        const clampedGridX = clampToGrid(Math.floor(cx / CELL_SIZE), gridSize);
        const clampedGridY = clampToGrid(Math.floor(cy / CELL_SIZE), gridSize);

        setMapData((prev) => ({
            ...prev,
            players: prev.players.map((c) =>
                c.id === dragging.playerId ? { ...c, gridX: clampedGridX, gridY: clampedGridY } : c
            )
        }));
    }, [dragging, mapData, gridSize, setMapData, svgRef]);

    const handlePointerUp = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;

        const svgPt = toSvgPoint(svg, e.clientX, e.clientY);
        if (!svgPt) { setDragging(null); return; }

        const player = mapData.players.find((c) => c.id === dragging.playerId);
        if (!player) {
            setDragging(null);
            return;
        }

        const cx = svgPt.x - dragging.offsetX;
        const cy = svgPt.y - dragging.offsetY;

        const clampedGridX = clampToGrid(Math.floor(cx / CELL_SIZE), gridSize);
        const clampedGridY = clampToGrid(Math.floor(cy / CELL_SIZE), gridSize);

        // Collision detection: find the nearest unoccupied grid square
        const occupiedSquares = new Set(
            mapData.players
                .filter((c) => c.id !== dragging.playerId)
                .map((c) => `${c.gridX},${c.gridY}`)
        );

        const { targetX, targetY } = findFreeSquare(clampedGridX, clampedGridY, occupiedSquares, gridSize);

        setMapData((prev) => ({
            ...prev,
            players: prev.players.map((c) =>
                c.id === dragging.playerId ? { ...c, gridX: targetX, gridY: targetY } : c
            )
        }));

        if (svg) svg.releasePointerCapture(e.pointerId);
        setDragging(null);

        // Track movement for Steady Aim: if the player moved, mark them as having moved
        if (campaignName && player) {
            const oldGridX = player.gridX;
            const oldGridY = player.gridY;
            if (oldGridX !== targetX || oldGridY !== targetY) {
                setRuntimeValue(player.name || player.id, 'steadyAimMovedThisTurn', true, campaignName);
            }
        }
    }, [dragging, mapData, gridSize, setMapData, svgRef, campaignName]);

    const handlePointerLeave = useCallback((e) => {
        if (!dragging) return;
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setDragging(null);
    }, [dragging, svgRef]);

    return { dragging, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave };
}
