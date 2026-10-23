import { useState, useCallback } from 'react';
import { TOOL_PAINT, TOOL_ERASE } from '../../../config/mapConfig';

function useWallDrawing({ isLocalhost, tool, getGridFromEvent, svgRef }) {
    const [painting, setPainting] = useState(null);

    const handleGridPointerDown = useCallback((e, setMapData) => {
        if (!isLocalhost) return;
        if (tool !== TOOL_PAINT && tool !== TOOL_ERASE) return;
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;

        // #883 capture discipline (fix#53 house shape — useItemDragging.js:42-47,
        // useRuler.js:22-27 validate-capture-commit): capture only once the stroke
        // has verifiably started on a valid grid cell. Capturing before the grid
        // guard stranded the pointer on failed presses outside the map.
        // painting !== null now strictly implies captured.
        const svg = svgRef.current;
        if (svg) svg.setPointerCapture(e.pointerId);

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
        if (!painting) return; // failed down never captured — bailing strands nothing (fix#53 mirror, useItemDragging.js:101-104)
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setPainting(null);
    }, [painting, svgRef]);

    const handleGridPointerLeave = useCallback((e) => {
        if (!painting) return; // idle leave never captured — releasing would throw NotFoundError (fix#53 mirror)
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setPainting(null);
    }, [painting, svgRef]);

    return {
        painting,
        handleGridPointerDown,
        handleGridPointerMove,
        handleGridPointerUp,
        handleGridPointerLeave,
    };
}

export default useWallDrawing;
