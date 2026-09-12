import { useState, useCallback, useRef } from 'react';
import { OverlayShape, createOverlay, hitTestOverlay, svgOrigin } from '../../../models/SpellOverlay';

const EDGE_FRACTION = 0.25;
const ROTATABLE_SHAPES = [OverlayShape.CONE, OverlayShape.LINE, OverlayShape.CUBE];

function computeAngle(originX, originY, cursorX, cursorY) {
    const dx = cursorX - originX;
    const dy = cursorY - originY;
    const radians = Math.atan2(dy, dx);
    let degrees = radians * (180 / Math.PI);
    if (degrees < 0) degrees += 360;
    return degrees;
}

function capturePointer(svgRef, e) {
    const svg = svgRef.current;
    if (svg) svg.setPointerCapture(e.pointerId);
}

function shouldRotateOnGrab(overlay, origin, screenPt, gx, gy) {
    if (!ROTATABLE_SHAPES.includes(overlay.shape)) return false;
    if (gx === overlay.startGridX && gy === overlay.startGridY) return false;
    const dx = screenPt.x - origin.x;
    const dy = screenPt.y - origin.y;
    const distFromOrigin = Math.sqrt(dx * dx + dy * dy);
    const overlayDist = ((overlay.distanceFt || overlay.sizeFt || 0) / 5) * 40;
    return distFromOrigin > overlayDist * EDGE_FRACTION;
}

function useSpellHandlers({ rulerMode, getGridFromEvent, clientToSVG, addOverlay, shapeParams, updateOverlay, updateOverlayImmediate, svgRef }) {
    const [spellDraft, setSpellDraft] = useState(null);
    const [dragOverlay, setDragOverlay] = useState(null);
    const [rotateOverlay, setRotateOverlay] = useState(null);
    // eslint-disable-next-line server-first/no-local-game-state
    const spellDragActiveRef = useRef(false);

    const handleSpellPointerDown = useCallback((e, spellMode, overlays) => {
        if (rulerMode) return;
        const grid = getGridFromEvent(e);
        if (!grid) return;
        const gx = Math.floor(grid.gridX);
        const gy = Math.floor(grid.gridY);

        if (spellMode) {
            e.preventDefault();
            if (spellMode === OverlayShape.SPHERE || spellMode === OverlayShape.CYLINDER) {
                addOverlay(createOverlay(spellMode, gx, gy, 0, shapeParams));
            } else {
                setSpellDraft({
                    startGridX: gx,
                    startGridY: gy,
                    startScreenX: e.clientX,
                    startScreenY: e.clientY,
                    angle: 0,
                });
            }
            return;
        }

        for (let i = overlays.length - 1; i >= 0; i--) {
            const overlay = overlays[i];
            if (!hitTestOverlay(overlay, gx, gy)) continue;
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            const origin = svgOrigin(overlay);
            const screenPt = clientToSVG(e.clientX, e.clientY);
            if (!screenPt) return;
            spellDragActiveRef.current = true;
            capturePointer(svgRef, e);
            if (shouldRotateOnGrab(overlay, origin, screenPt, gx, gy)) {
                const initialAngle = computeAngle(origin.x, origin.y, screenPt.x, screenPt.y);
                setRotateOverlay({
                    overlayId: overlay.id,
                    originX: origin.x,
                    originY: origin.y,
                    startAngle: overlay.angle,
                    offsetAngle: initialAngle - overlay.angle,
                });
            } else {
                setDragOverlay({
                    overlayId: overlay.id,
                    offsetX: gx - overlay.startGridX,
                    offsetY: gy - overlay.startGridY,
                });
            }
            return;
        }
    }, [rulerMode, getGridFromEvent, clientToSVG, addOverlay, shapeParams, svgRef]);

    const handleSpellPointerMove = useCallback((e, spellDraft) => {
        if (!spellDraft) return;
        e.preventDefault();
        const angle = computeAngle(spellDraft.startScreenX, spellDraft.startScreenY, e.clientX, e.clientY);
        setSpellDraft(prev => prev ? { ...prev, angle } : null);
    }, []);

    const handleSpellPointerUp = useCallback((e, spellDraft, spellMode, addOverlay, shapeParams) => {
        if (!spellDraft) return;
        const angle = computeAngle(spellDraft.startScreenX, spellDraft.startScreenY, e.clientX, e.clientY);
        const overlay = createOverlay(spellMode, spellDraft.startGridX, spellDraft.startGridY, angle, shapeParams);
        addOverlay(overlay);
        setSpellDraft(null);
    }, []);

    const handleSpellDragMove = useCallback((e, dragOverlay, rotateOverlay, overlays) => {
        if (dragOverlay) {
            e.preventDefault();
            const grid = getGridFromEvent(e);
            if (!grid) return;
            const overlay = overlays.find(o => o.id === dragOverlay.overlayId);
            if (!overlay) return;
            updateOverlay({
                ...overlay,
                startGridX: Math.floor(grid.gridX) - dragOverlay.offsetX,
                startGridY: Math.floor(grid.gridY) - dragOverlay.offsetY,
            });
        } else if (rotateOverlay) {
            e.preventDefault();
            const overlay = overlays.find(o => o.id === rotateOverlay.overlayId);
            if (!overlay) return;
            const origin = svgOrigin(overlay);
            const screenPt = clientToSVG(e.clientX, e.clientY);
            if (!screenPt) return;
            let newAngle = computeAngle(origin.x, origin.y, screenPt.x, screenPt.y) - rotateOverlay.offsetAngle;
            if (newAngle < 0) newAngle += 360;
            updateOverlay({ ...overlay, angle: newAngle });
        }
    }, [getGridFromEvent, clientToSVG, computeAngle]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSpellDragEnd = useCallback((e, dragOverlay, rotateOverlay, overlays, svgRef) => {
        if (dragOverlay) {
            const grid = getGridFromEvent(e);
            if (grid) {
                const overlay = overlays.find(o => o.id === dragOverlay.overlayId);
                if (overlay) {
                    updateOverlayImmediate({
                        ...overlay,
                        startGridX: Math.floor(grid.gridX) - dragOverlay.offsetX,
                        startGridY: Math.floor(grid.gridY) - dragOverlay.offsetY,
                    });
                }
            }
            setDragOverlay(null);
        } else if (rotateOverlay) {
            const overlay = overlays.find(o => o.id === rotateOverlay.overlayId);
            if (overlay) {
                const origin = svgOrigin(overlay);
                const screenPt = clientToSVG(e.clientX, e.clientY);
                if (screenPt) {
                    let newAngle = computeAngle(origin.x, origin.y, screenPt.x, screenPt.y) - rotateOverlay.offsetAngle;
                    if (newAngle < 0) newAngle += 360;
                    updateOverlayImmediate({ ...overlay, angle: newAngle });
                }
            }
            setRotateOverlay(null);
        }
        spellDragActiveRef.current = false;
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
    }, [getGridFromEvent, clientToSVG, computeAngle, svgRef]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        spellDraft, setSpellDraft,
        dragOverlay, rotateOverlay,
        spellDragActiveRef,
        handleSpellPointerDown, handleSpellPointerMove, handleSpellPointerUp,
        handleSpellDragMove, handleSpellDragEnd,
    };
}

export default useSpellHandlers;
