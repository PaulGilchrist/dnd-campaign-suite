import { useState, useCallback } from 'react';

const CELL_SIZE = 40;

export default function usePlayerDragging({
    svgRef,
    mapData,
    gridSize,
    panX,
    panY,
    setMapData,
    gridCenterX,
    gridCenterY,
}) {
    const [dragging, setDragging] = useState(null);

    const handlePointerDown = useCallback((e, playerId) => {
        e.stopPropagation();
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;

        const player = mapData.players.find((c) => c.id === playerId);
        if (!player) return;

        const cx = gridCenterX(player.gridX);
        const cy = gridCenterY(player.gridY);

        setDragging({
            playerId,
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

        const player = mapData.players.find((c) => c.id === dragging.playerId);
        if (!player) return;

        const cx = svgX - dragging.offsetX;
        const cy = svgY - dragging.offsetY;

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

        const player = mapData.players.find((c) => c.id === dragging.playerId);
        if (!player) {
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
            players: prev.players.map((c) =>
                c.id === dragging.playerId ? { ...c, gridX: targetX, gridY: targetY } : c
            )
        }));

        setDragging(null);
    }, [dragging, mapData, gridSize, panX, panY]);

    const handlePointerLeave = useCallback(() => {
        setDragging(null);
    }, []);

    return { dragging, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave };
}
