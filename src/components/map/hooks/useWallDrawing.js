import { useState, useCallback } from 'react';
import { TOOL_PAINT, TOOL_ERASE } from '../../../config/mapConfig';

function useWallDrawing({ isLocalhost, tool, getGridFromEvent, svgRef }) {
    const [painting, setPainting] = useState(null);

    const handleGridPointerDown = useCallback((e, setMapData) => {
        if (!isLocalhost) return;
        if (tool !== TOOL_PAINT && tool !== TOOL_ERASE) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (svg) svg.setPointerCapture(e.pointerId);
        const grid = getGridFromEvent(e);
        if (!grid) return;

        const key = `${Math.floor(grid.gridX)},${Math.floor(grid.gridY)}`;
        setMapData(prev => {
            const newWalls = new Set(prev.walls);
            if (tool === TOOL_PAINT) {
                newWalls.add(key);
            } else if (tool === TOOL_ERASE) {
                newWalls.delete(key);
            }
            return { ...prev, walls: newWalls };
        });
        setPainting(grid);
    }, [isLocalhost, tool, getGridFromEvent, svgRef]);

    const handleGridPointerMove = useCallback((e, setMapData, painting, tool) => {
        if (!isLocalhost) return;
        if (!painting || (tool !== TOOL_PAINT && tool !== TOOL_ERASE)) return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;

        const key = `${Math.floor(grid.gridX)},${Math.floor(grid.gridY)}`;
        setMapData(prev => {
            const newWalls = new Set(prev.walls);
            if (tool === TOOL_PAINT) {
                newWalls.add(key);
            } else if (tool === TOOL_ERASE) {
                newWalls.delete(key);
            }
            return { ...prev, walls: newWalls };
        });
    }, [isLocalhost, getGridFromEvent]);

    const handleGridPointerUp = useCallback((e) => {
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setPainting(null);
    }, [svgRef]);

    const handleGridPointerLeave = useCallback((e) => {
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setPainting(null);
    }, [svgRef]);

    return {
        painting,
        handleGridPointerDown,
        handleGridPointerMove,
        handleGridPointerUp,
        handleGridPointerLeave,
    };
}

export default useWallDrawing;
