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
        // #917: capture only once the pan has verifiably started (house pattern:
        // useRuler.js guards, validates, then captures; mirrors the #883/#910 fixes
        // in useItemDragging.js/usePlayerDragging.js). Pan move/up are mounted on
        // the svg element itself (Map.jsx), so without capture a drag that leaves
        // the svg mid-gesture stalls the pan. panning !== null now strictly implies
        // captured — which is also what makes handlePanEnd's release safe: before
        // this fix it released a capture that was never acquired, throwing
        // NotFoundError in real browsers (the test mock hid it).
        svg.setPointerCapture(e.pointerId);
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
        if (!panning) return; // failed down never captured — bailing strands nothing
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setPanning(null);
    }, [panning, svgRef]);

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
        // #917: below the threshold factor stays 1 — nothing to zoom. Return before
        // the writes: falling through called setZoom/setPanX/setPanY on every
        // sub-threshold trackpad tick, and the lossy x-(x-pan) round trip churned
        // held pan bytes (e.g. -19.9 -> -19.900000000000006) even at factor 1.
        // preventDefault already ran above, so default handling is unchanged.
        if (factor === 1) return;
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
