import { useState, useCallback } from 'react';
import { TOOL_ROOM } from '../../../config/mapConfig';
import { buildRoomWalls, createRoom } from '../../../services/maps/mapRoomUtils';

function useRoomDrawing({ isLocalhost, tool, getGridFromEvent, svgRef }) {
    const [roomDrawStart, setRoomDrawStart] = useState(null);
    const [roomDrawRect, setRoomDrawRect] = useState(null);
    const [selectedRoom, setSelectedRoom] = useState(null);

    const handleRoomPointerDown = useCallback((e) => {
        if (!isLocalhost || tool !== TOOL_ROOM) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (svg) svg.setPointerCapture(e.pointerId);
        const grid = getGridFromEvent(e);
        if (!grid) return;
        const gx = Math.floor(grid.gridX);
        const gy = Math.floor(grid.gridY);
        setRoomDrawStart({ gridX: gx, gridY: gy });
        setRoomDrawRect({ minX: gx, maxX: gx, minY: gy, maxY: gy });
        setSelectedRoom(null);
    }, [isLocalhost, tool, getGridFromEvent, svgRef]);

    const handleRoomPointerMove = useCallback((e) => {
        if (!isLocalhost || tool !== TOOL_ROOM || !roomDrawStart) return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;
        const gx = Math.floor(grid.gridX);
        const gy = Math.floor(grid.gridY);
        setRoomDrawRect({
            minX: Math.min(roomDrawStart.gridX, gx),
            maxX: Math.max(roomDrawStart.gridX, gx),
            minY: Math.min(roomDrawStart.gridY, gy),
            maxY: Math.max(roomDrawStart.gridY, gy),
        });
    }, [isLocalhost, tool, roomDrawStart, getGridFromEvent]);

    const handleRoomPointerUp = useCallback((e, gridSize, setMapData) => {
        if (!isLocalhost || tool !== TOOL_ROOM || !roomDrawStart || !roomDrawRect) {
            setRoomDrawStart(null);
            setRoomDrawRect(null);
            return;
        }
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);

        const { minX, maxX, minY, maxY } = roomDrawRect;
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        if (w < 3 || h < 3) {
            setRoomDrawStart(null);
            setRoomDrawRect(null);
            return;
        }

        setMapData(prev => {
            const newWalls = buildRoomWalls(prev.walls, minX, maxX, minY, maxY, gridSize);
            const newRoom = createRoom(minX, minY, w, h);
            return {
                ...prev,
                walls: newWalls,
                rooms: [...(prev.rooms || []), newRoom],
            };
        });

        setRoomDrawStart(null);
        setRoomDrawRect(null);
    }, [isLocalhost, tool, roomDrawStart, roomDrawRect, svgRef]);

    const handleRoomClick = useCallback((e, mapData, tool) => {
        if (!isLocalhost) return;
        if (tool !== 'none' && tool !== 'select') return;
        const grid = getGridFromEvent(e);
        if (!grid) return;
        const gx = Math.floor(grid.gridX);
        const gy = Math.floor(grid.gridY);
        const rooms = mapData?.rooms || [];
        if (rooms.length === 0) return;

        let bestRoom = null;
        let bestArea = Infinity;
        for (const room of rooms) {
            const r = room.rect;
            if (gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h) {
                const area = r.w * r.h;
                if (area < bestArea) {
                    bestArea = area;
                    bestRoom = room;
                }
            }
        }
        setSelectedRoom(bestRoom);
    }, [isLocalhost, getGridFromEvent]);

    return {
        roomDrawStart, roomDrawRect, selectedRoom, setSelectedRoom,
        handleRoomPointerDown, handleRoomPointerMove, handleRoomPointerUp, handleRoomClick,
    };
}

export default useRoomDrawing;
