import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MIN_ZOOM, MAX_ZOOM } from '../../../config/outdoorConfig.js';
import useHeldKeys from '../../../hooks/ui/useHeldKeys.js';
import {
    hexGridPixelBounds, clampHexPan, centerHexView, resolveHexResetView,
} from '../../../services/maps/hexViewMath.js';

// Keyboard camera speeds — shared contract with the indoor lane
// (map/hooks/useZoomPan.js): pan in CSS px/s (constant SCREEN speed at any
// zoom), zoom as a continuous exponential rate per second.
const KEY_PAN_PX_PER_SEC = 900;
const KEY_ZOOM_RATE = 0.9;

function useZoomPan({ svgRef, hexCols, hexRows, zoom, setZoom, panX, setPanX, panY, setPanY, keyboardEnabled = false, storedViewRef = null }) {
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

    // Reset law (owner 2026-11-26, unified with the indoor contract): R and the
    // toolbar button restore the doc's stored/mount-adopted view bytes — the
    // loader's storedViewRef (restated by the mount auto-fit) — NOT a
    // VIEW_RESET_ZOOM re-center, which used to discard the saved view and
    // persist that loss through the autosave. No adopted view yet (fresh doc)
    // → the pure seam answers with the legacy centered reset geometry.
    const resetView = useCallback(() => {
        const target = resolveHexResetView(storedViewRef && storedViewRef.current, hexCols, hexRows);
        setZoom(target.zoom);
        setPanX(target.panX);
        setPanY(target.panY);
    }, [storedViewRef, hexCols, hexRows, setZoom, setPanX, setPanY]);

    // ── Keyboard camera lane (trackpad game-day, owner 2026-11-25) ──
    // Same contract as the indoor lane: held keys move at a constant SCREEN
    // speed (CSS px/s converted through the live viewBox), zoom pins the
    // viewport centre, and EVERY step rides the existing clampPan so the
    // keyboard can never push the view outside the board. Committed bytes
    // flow through the same loader setters as mouse pans, so the outdoor
    // view autosave/persistence lane is unchanged.
    const keyPanStep = useCallback((forward, strafe, shift, dt, scale) => {
        const step = KEY_PAN_PX_PER_SEC * (shift ? 2 : 1) * dt * scale;
        const clamped = clampPan(zoomValueRef.current,
            panXValueRef.current + strafe * step,
            panYValueRef.current - forward * step);
        setPanX(clamped.x);
        setPanY(clamped.y);
    }, [clampPan, setPanX, setPanY]);

    const keyZoomStep = useCallback((zoomDir, dt, viewW, viewH) => {
        const currentZoom = zoomValueRef.current;
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM,
            currentZoom * Math.exp(zoomDir * KEY_ZOOM_RATE * dt)));
        if (next === currentZoom) return;
        let newPanX = panXValueRef.current;
        let newPanY = panYValueRef.current;
        if (viewW && viewH) {
            const cx = newPanX + viewW / 2;
            const cy = newPanY + viewH / 2;
            newPanX = cx - (viewW * currentZoom / next) / 2;
            newPanY = cy - (viewH * currentZoom / next) / 2;
        }
        const clamped = clampPan(next, newPanX, newPanY);
        setZoom(next);
        setPanX(clamped.x);
        setPanY(clamped.y);
    }, [clampPan, setZoom, setPanX, setPanY]);

    const handleKeyFrame = useCallback(({ forward, strafe, zoom: zoomDir, shift, dt }) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox && svg.viewBox.baseVal;
        const viewW = vb && vb.width ? vb.width : 0;
        const viewH = vb && vb.height ? vb.height : 0;
        if (forward || strafe) {
            keyPanStep(forward, strafe, shift, dt, rect.width && viewW ? viewW / rect.width : 1);
        }
        if (zoomDir) keyZoomStep(zoomDir, dt, viewW, viewH);
    }, [svgRef, keyPanStep, keyZoomStep]);

    useHeldKeys({
        enabled: keyboardEnabled,
        onFrame: handleKeyFrame,
        // R resets — the same committed view the toolbar Reset button gives.
        onAction: keyboardEnabled ? resetView : undefined,
    });

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
