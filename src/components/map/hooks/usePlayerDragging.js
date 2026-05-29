import { useState, useCallback } from 'react';

const CELL_SIZE = 40;

export default function usePlayerDragging({
    svgRef,
    mapData,
    gridSize,
    setMapData,
    gridCenterX,
    gridCenterY,
    rulerMode,
    spellMode,
}) {
    const [dragging, setDragging] = useState(null);

    const handlePointerDown = useCallback((e, playerId) => {
        if (rulerMode || spellMode) return;
        e.stopPropagation();
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        svg.setPointerCapture(e.pointerId);

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const svgPt = pt.matrixTransform(ctm.inverse());

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

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const svgPt = pt.matrixTransform(ctm.inverse());

        const player = mapData.players.find((c) => c.id === dragging.playerId);
        if (!player) return;

        const cx = svgPt.x - dragging.offsetX;
        const cy = svgPt.y - dragging.offsetY;

        const gridX = Math.floor(cx / CELL_SIZE);
        const gridY = Math.floor(cy / CELL_SIZE);

        const clampedGridX = Math.max(0, Math.min(gridSize - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(gridSize - 1, gridY));

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

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) { setDragging(null); return; }
        const svgPt = pt.matrixTransform(ctm.inverse());

        const player = mapData.players.find((c) => c.id === dragging.playerId);
        if (!player) {
            setDragging(null);
            return;
        }

        const cx = svgPt.x - dragging.offsetX;
        const cy = svgPt.y - dragging.offsetY;

        const gridX = Math.floor(cx / CELL_SIZE);
        const gridY = Math.floor(cy / CELL_SIZE);

        const clampedGridX = Math.max(0, Math.min(gridSize - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(gridSize - 1, gridY));

        // Collision detection: find the nearest unoccupied grid square
        const occupiedSquares = new Set(
            mapData.players
                .filter((c) => c.id !== dragging.playerId)
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
            players: prev.players.map((c) =>
                c.id === dragging.playerId ? { ...c, gridX: targetX, gridY: targetY } : c
            )
        }));

        if (svg) svg.releasePointerCapture(e.pointerId);
        setDragging(null);
    }, [dragging, mapData, gridSize, setMapData, svgRef]);

    const handlePointerLeave = useCallback((e) => {
        if (!dragging) return;
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setDragging(null);
    }, [dragging, svgRef]);

    return { dragging, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave };
}
