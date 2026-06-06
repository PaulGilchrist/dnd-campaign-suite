import { useState, useCallback, useEffect } from 'react';

function useRuler() {
    const [rulerMode, setRulerMode] = useState(false);
    const [rulerStart, setRulerStart] = useState(null);
    const [rulerEnd, setRulerEnd] = useState(null);
    const [rulerPreview, setRulerPreview] = useState(null);

    const resetRuler = useCallback(() => {
        setRulerStart(null);
        setRulerEnd(null);
        setRulerPreview(null);
    }, []);

    useEffect(() => {
        if (!rulerMode) {
            resetRuler();
        }
    }, [rulerMode, resetRuler]);

    const handleRulerPointerDown = useCallback((e, rulerMode, rulerStart, rulerEnd, getGridFromEvent, svgRef) => {
        if (!rulerMode) return;
        const grid = getGridFromEvent(e);
        if (!grid) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (svg) svg.setPointerCapture(e.pointerId);

        const gx = Math.floor(grid.gridX);
        const gy = Math.floor(grid.gridY);

        if (!rulerStart) {
            setRulerStart({ gridX: gx, gridY: gy });
            setRulerEnd(null);
            setRulerPreview(null);
        } else if (!rulerEnd) {
            setRulerEnd({ gridX: gx, gridY: gy });
            setRulerPreview(null);
        } else {
            setRulerStart({ gridX: gx, gridY: gy });
            setRulerEnd(null);
            setRulerPreview(null);
        }
    }, []);

    const handleRulerPointerMove = useCallback((e, rulerMode, rulerStart, rulerEnd, getGridFromEvent) => {
        if (!rulerMode || !rulerStart || rulerEnd) return;
        const grid = getGridFromEvent(e);
        if (!grid) return;
        setRulerPreview({ gridX: Math.floor(grid.gridX), gridY: Math.floor(grid.gridY) });
    }, []);

    const handleRulerPointerUp = useCallback((e, rulerMode, svgRef) => {
        if (!rulerMode) return;
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
    }, []);

    return {
        rulerMode, setRulerMode,
        rulerStart, rulerEnd, rulerPreview,
        resetRuler,
        handleRulerPointerDown, handleRulerPointerMove, handleRulerPointerUp,
    };
}

export default useRuler;
