import { useState, useCallback } from 'react';
import { CELL_SIZE } from '../../../config/mapConfig';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import {
    computeMovementObstacles,
    computeReachable,
    findNearestValid,
} from '../../../services/maps/reachability.js';

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
    const found = findNearestValid(
        startX,
        startY,
        (x, y) => !occupiedSquares.has(`${x},${y}`),
        gridSize
    );
    return { targetX: found ? found.x : startX, targetY: found ? found.y : startY };
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
    isLocalhost,
    walls,
    placedItems,
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

        // The GM can hold Shift to bypass the walkable-cell constraint
        // (narrative teleports); everyone else may only drag the token
        // through cells it could actually walk through.
        const unconstrained = Boolean(isLocalhost && e.shiftKey);
        const reachable = unconstrained
            ? null
            : computeReachable(player.gridX, player.gridY, computeMovementObstacles(walls, placedItems), gridSize);

        setDragging({
            playerId,
            pointerId: e.pointerId,
            offsetX: svgPt.x - cx,
            offsetY: svgPt.y - cy,
            unconstrained,
            reachable,
        });
    }, [rulerMode, spellMode, mapData, gridCenterX, gridCenterY, svgRef, isLocalhost, walls, placedItems, gridSize]);

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

        if (!dragging.unconstrained) {
            // Keep the token inside its walkable region so the fog of war
            // cannot be lifted across walls or closed doors.
            const valid = dragging.reachable.has(`${clampedGridX},${clampedGridY}`);
            if (!valid) {
                setDragging((prev) => (prev && !prev.invalid ? { ...prev, invalid: true } : prev));
                return;
            }
            if (dragging.invalid) {
                setDragging((prev) => (prev && prev.invalid ? { ...prev, invalid: false } : prev));
            }
        }

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

        let targetX;
        let targetY;
        if (dragging.unconstrained) {
            ({ targetX, targetY } = findFreeSquare(clampedGridX, clampedGridY, occupiedSquares, gridSize));
        } else {
            // The drop must be a cell the player could walk to: reachable
            // from where the drag started, not a wall or closed door, and
            // unoccupied. Otherwise snap to the nearest such cell, falling
            // back to the player's current cell if none exists.
            const found = findNearestValid(
                clampedGridX,
                clampedGridY,
                (x, y) => dragging.reachable.has(`${x},${y}`) && !occupiedSquares.has(`${x},${y}`),
                gridSize
            );
            targetX = found ? found.x : player.gridX;
            targetY = found ? found.y : player.gridY;
        }

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
