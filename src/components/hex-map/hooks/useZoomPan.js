import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MIN_ZOOM, MAX_ZOOM } from '../../../config/outdoorConfig.js';
import {
    hexGridPixelBounds, clampHexPan, centerHexView, VIEW_RESET_ZOOM,
} from '../../../services/maps/hexViewMath.js';

function useZoomPan({ svgRef, hexCols, hexRows, zoom, setZoom, panX, setPanX, panY, setPanY }) {
    const [panning, setPanning] = useState(null);

    const zoomValueRef = useRef(MIN_ZOOM);
    const panXValueRef = useRef(0);
    const panYValueRef = useRef(0);
    const accumulatedDeltaRef = useRef(0);

    // Bounds/clamp/center math lives in services/maps/hexViewMath.js so the
    // loader's settle-at-mount pass computes bit-identical view bytes.
    const gridPixelBounds = useMemo(
        () => hexGridPixelBounds(hexCols, hexRows),
        [hexCols, hexRows],
    );

    const svgWidth = gridPixelBounds.width;
    const svgHeight = gridPixelBounds.height;

    const clampPan = useCallback(
        (pz, px, py) => clampHexPan(gridPixelBounds, hexRows, pz, px, py),
        [gridPixelBounds, hexRows],
    );

    const centerView = useCallback(
        (targetZoom) => centerHexView(hexCols, hexRows, targetZoom),
        [hexCols, hexRows],
    );

    const zoomIn = useCallback(() => {
        setZoom(prev => {
            const next = Math.min(MAX_ZOOM, prev * 1.25);
            const clamped = centerView(next);
            setPanX(clamped.x);
            setPanY(clamped.y);
            return next;
        });
    }, [centerView, setZoom, setPanX, setPanY]);

    const zoomOut = useCallback(() => {
        setZoom(prev => {
            const next = Math.max(MIN_ZOOM, prev * 0.8);
            const clamped = centerView(next);
            setPanX(clamped.x);
            setPanY(clamped.y);
            return next;
        });
    }, [centerView, setZoom, setPanX, setPanY]);

    const resetView = useCallback(() => {
        const clamped = centerView(VIEW_RESET_ZOOM);
        setZoom(VIEW_RESET_ZOOM);
        setPanX(clamped.x);
        setPanY(clamped.y);
    }, [centerView, setZoom, setPanX, setPanY]);

    const handlePanStart = useCallback((e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;
        setPanning({ startX: svgX, startY: svgY, startPanX: panX, startPanY: panY });
    }, [svgRef, panX, panY]);

    const handlePanMove = useCallback((e) => {
        if (!panning) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;
        const dx = svgX - panning.startX;
        const dy = svgY - panning.startY;
        const clamped = clampPan(zoomValueRef.current, panning.startPanX - dx, panning.startPanY - dy);
        setPanX(clamped.x);
        setPanY(clamped.y);
    }, [panning, clampPan, setPanX, setPanY, svgRef]);

    const handlePanEnd = useCallback(() => {
        setPanning(null);
    }, []);

    const handleWheel = useCallback((e) => {
        if (!e.metaKey) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height;
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
        const newPanX = svgX - (svgX - currentPanX) * (currentZoom / newZoom);
        const newPanY = svgY - (svgY - currentPanY) * (currentZoom / newZoom);
        const clamped = clampPan(newZoom, newPanX, newPanY);
        setZoom(newZoom);
        setPanX(clamped.x);
        setPanY(clamped.y);
    }, [clampPan, setZoom, setPanX, setPanY, svgRef]);

    useEffect(() => { zoomValueRef.current = zoom; }, [zoom]);
    useEffect(() => { panXValueRef.current = panX; }, [panX]);
    useEffect(() => { panYValueRef.current = panY; }, [panY]);

    return {
        svgWidth, svgHeight,
        gridPixelBounds,
        zoomIn, zoomOut, resetView,
        clampPan, centerView,
        panning, handlePanStart, handlePanMove, handlePanEnd,
        handleWheel,
    };
}

export default useZoomPan;
