import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { HEX_SIZE, MIN_ZOOM, MAX_ZOOM } from '../../../config/outdoorConfig.js';

function useZoomPan(svgRef, hexCols, hexRows, zoom, setZoom, panX, setPanX, panY, setPanY) {
    const [panning, setPanning] = useState(null);

    const zoomValueRef = useRef(MIN_ZOOM);
    const panXValueRef = useRef(0);
    const panYValueRef = useRef(0);
    const accumulatedDeltaRef = useRef(0);

    const gridPixelBounds = useMemo(() => {
        const xMin = -HEX_SIZE * Math.sqrt(3) / 2;
        const xMax = HEX_SIZE * Math.sqrt(3) * ((hexCols - 1) + (hexRows - 1) / 2 + 0.5);
        const yMin = -HEX_SIZE;
        const yMax = HEX_SIZE * (1.5 * (hexRows - 1) + 1);
        return {
            width: xMax - xMin,
            height: yMax - yMin,
            offsetX: xMin,
            offsetY: yMin,
            centerX: (xMin + xMax) / 2,
            centerY: (yMin + yMax) / 2,
        };
    }, [hexCols, hexRows]);

    const svgWidth = gridPixelBounds.width;
    const svgHeight = gridPixelBounds.height;

    const MARGIN_X = (hexRows - 1) / 2 || 0.5;
    const MARGIN_Y = hexRows / 4 - 1 || 0.5;

    const clampPan = useCallback((pz, px, py) => {
        const viewW = gridPixelBounds.width / pz;
        const viewH = gridPixelBounds.height / pz;
        const sqrt3 = Math.sqrt(3);
        const hexW = sqrt3 * HEX_SIZE;
        const hexH = 1.5 * HEX_SIZE;
        const marginX = MARGIN_X * hexW;
        const marginY = MARGIN_Y * hexH;

        const gridLeft = gridPixelBounds.offsetX + marginX;
        const gridRight = gridPixelBounds.offsetX + gridPixelBounds.width - marginX;
        const gridTop = gridPixelBounds.offsetY + marginY;
        const gridBottom = gridPixelBounds.offsetY + gridPixelBounds.height - marginY;

        const minPanX = gridLeft;
        const maxPanX = gridRight - viewW;
        const minPanY = gridTop;
        const maxPanY = gridBottom - viewH;

        return {
            x: Math.min(maxPanX, Math.max(minPanX, px)),
            y: Math.min(maxPanY, Math.max(minPanY, py)),
        };
    }, [gridPixelBounds, MARGIN_X, MARGIN_Y]);

    const centerView = useCallback((targetZoom) => {
        const vw = gridPixelBounds.width / targetZoom;
        const vh = gridPixelBounds.height / targetZoom;
        const cx = gridPixelBounds.centerX - vw / 2;
        const cy = gridPixelBounds.centerY - vh / 2;
        return clampPan(targetZoom, cx, cy);
    }, [gridPixelBounds, clampPan]);

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
        const clamped = centerView(2);
        setZoom(2);
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
