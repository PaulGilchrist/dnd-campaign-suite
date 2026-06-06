import { useState, useCallback, useRef, useEffect } from 'react';
import { MIN_ZOOM, MAX_ZOOM, CELL_SIZE } from '../../../config/mapConfig';

function useZoomPan(svgRef) {
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);

    const zoomValueRef = useRef(1);
    const panXValueRef = useRef(0);
    const panYValueRef = useRef(0);
    const accumulatedDeltaRef = useRef(0);

    const clientToSVG = useCallback((clientX, clientY) => {
        const svg = svgRef.current;
        if (!svg) return null;
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return null;
        const svgPt = pt.matrixTransform(ctm.inverse());
        return { x: svgPt.x, y: svgPt.y };
    }, [svgRef]);

    const zoomIn = useCallback(() => {
        setZoom(prev => Math.min(MAX_ZOOM, prev * 1.25));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom(prev => Math.max(MIN_ZOOM, prev * 0.8));
    }, []);

    const resetView = useCallback(() => {
        setZoom(1);
        setPanX(0);
        setPanY(0);
    }, []);

    const gridCenterX = useCallback((gridX) => gridX * CELL_SIZE + CELL_SIZE / 2, []);
    const gridCenterY = useCallback((gridY) => gridY * CELL_SIZE + CELL_SIZE / 2, []);

    const getGridFromEvent = useCallback((e) => {
        const svgPt = clientToSVG(e.clientX, e.clientY);
        if (!svgPt) return null;
        return { gridX: svgPt.x / CELL_SIZE, gridY: svgPt.y / CELL_SIZE };
    }, [clientToSVG]);

    const [panning, setPanning] = useState(null);

    const handlePanStart = useCallback((e, panX, panY) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        const svgPt = clientToSVG(e.clientX, e.clientY);
        if (!svgPt) return;
        setPanning({
            startX: svgPt.x,
            startY: svgPt.y,
            startPanX: panX,
            startPanY: panY,
        });
    }, [clientToSVG, svgRef]);

    const handlePanMove = useCallback((e) => {
        if (!panning) return;
        e.preventDefault();
        const svgPt = clientToSVG(e.clientX, e.clientY);
        if (!svgPt) return;
        const dx = svgPt.x - panning.startX;
        const dy = svgPt.y - panning.startY;
        setPanX(panning.startPanX - dx);
        setPanY(panning.startPanY - dy);
    }, [panning, clientToSVG]);

    const handlePanEnd = useCallback((e) => {
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setPanning(null);
    }, [svgRef]);

    const handleWheel = useCallback((e) => {
        if (!e.metaKey) return;
        e.preventDefault();
        const svgPt = clientToSVG(e.clientX, e.clientY);
        if (!svgPt) return;
        const currentZoom = zoomValueRef.current;
        const currentPanX = panXValueRef.current;
        const currentPanY = panYValueRef.current;
        accumulatedDeltaRef.current += e.deltaY;
        const accumulated = accumulatedDeltaRef.current;
        const ZOOM_THRESHOLD = 20;
        let factor = 1;
        if (accumulated < -ZOOM_THRESHOLD) {
            factor = 1.05;
            accumulatedDeltaRef.current = 0;
        } else if (accumulated > ZOOM_THRESHOLD) {
            factor = 0.95;
            accumulatedDeltaRef.current = 0;
        }
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * factor));
        const newPanX = svgPt.x - (svgPt.x - currentPanX) * (currentZoom / newZoom);
        const newPanY = svgPt.y - (svgPt.y - currentPanY) * (currentZoom / newZoom);
        setZoom(newZoom);
        setPanX(newPanX);
        setPanY(newPanY);
    }, [clientToSVG]);

    useEffect(() => { zoomValueRef.current = zoom; }, [zoom]);
    useEffect(() => { panXValueRef.current = panX; }, [panX]);
    useEffect(() => { panYValueRef.current = panY; }, [panY]);

    return {
        zoom, panX, panY,
        zoomIn, zoomOut, resetView,
        gridCenterX, gridCenterY,
        getGridFromEvent,
        panning, handlePanStart, handlePanMove, handlePanEnd,
        handleWheel,
        clientToSVG,
    };
}

export default useZoomPan;
