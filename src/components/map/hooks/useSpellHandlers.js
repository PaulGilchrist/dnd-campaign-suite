import { useState, useCallback, useRef } from 'react';
import { OverlayShape, createOverlay, hitTestOverlay, svgOrigin } from '../../../models/SpellOverlay';

function useSpellHandlers({ rulerMode, getGridFromEvent, clientToSVG, addOverlay, shapeParams, updateOverlay, updateOverlayImmediate, svgRef }) {
    const [spellDraft, setSpellDraft] = useState(null);
    const [dragOverlay, setDragOverlay] = useState(null);
    const [rotateOverlay, setRotateOverlay] = useState(null);
    const spellDragActiveRef = useRef(false);

    const computeAngle = useCallback((originX, originY, cursorX, cursorY) => {
        const dx = cursorX - originX;
        const dy = cursorY - originY;
        const radians = Math.atan2(dy, dx);
        let degrees = radians * (180 / Math.PI);
        if (degrees < 0) degrees += 360;
        return degrees;
    }, []);

    const handleSpellPointerDown = useCallback((e, spellMode, overlays) => {
        if (rulerMode) return;
        const grid = getGridFromEvent(e);
        if (!grid) return;
        const gx = Math.floor(grid.gridX);
        const gy = Math.floor(grid.gridY);

        if (spellMode) {
            e.preventDefault();
            if (spellMode === OverlayShape.SPHERE || spellMode === OverlayShape.CYLINDER) {
                const overlay = createOverlay(spellMode, gx, gy, 0, shapeParams);
                addOverlay(overlay);
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
            if (hitTestOverlay(overlay, gx, gy)) {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                const origin = svgOrigin(overlay);
                const screenPt = clientToSVG(e.clientX, e.clientY);
                if (!screenPt) return;
                const dx = screenPt.x - origin.x;
                const dy = screenPt.y - origin.y;
                const distFromOrigin = Math.sqrt(dx * dx + dy * dy);
                const isAtOrigin = gx === overlay.startGridX && gy === overlay.startGridY;
                const EDGE_FRACTION = 0.25;
                const overlayDist = ((overlay.distanceFt || overlay.sizeFt || 0) / 5) * 40;
                const isNearEdge = !isAtOrigin && overlay.shape !== OverlayShape.SPHERE && overlay.shape !== OverlayShape.CYLINDER && distFromOrigin > overlayDist * EDGE_FRACTION;
                if (isNearEdge && (overlay.shape === OverlayShape.CONE || overlay.shape === OverlayShape.LINE || overlay.shape === OverlayShape.CUBE)) {
                    const initialAngle = computeAngle(origin.x, origin.y, screenPt.x, screenPt.y);
                    spellDragActiveRef.current = true;
                    const svg = svgRef.current;
                    if (svg) svg.setPointerCapture(e.pointerId);
                    setRotateOverlay({
                        overlayId: overlay.id,
                        originX: origin.x,
                        originY: origin.y,
                        startAngle: overlay.angle,
                        offsetAngle: initialAngle - overlay.angle,
                    });
                } else {
                    spellDragActiveRef.current = true;
                    const svg = svgRef.current;
                    if (svg) svg.setPointerCapture(e.pointerId);
                    setDragOverlay({
                        overlayId: overlay.id,
                        offsetX: gx - overlay.startGridX,
                        offsetY: gy - overlay.startGridY,
                    });
                }
                return;
            }
        }
    }, [rulerMode, getGridFromEvent, clientToSVG, computeAngle, addOverlay, shapeParams, svgRef]);

    const handleSpellPointerMove = useCallback((e, spellDraft) => {
        if (!spellDraft) return;
        e.preventDefault();
        const angle = computeAngle(spellDraft.startScreenX, spellDraft.startScreenY, e.clientX, e.clientY);
        setSpellDraft(prev => prev ? { ...prev, angle } : null);
    }, [computeAngle]);

    const handleSpellPointerUp = useCallback((e, spellDraft, spellMode, addOverlay, shapeParams) => {
        if (!spellDraft) return;
        const angle = computeAngle(spellDraft.startScreenX, spellDraft.startScreenY, e.clientX, e.clientY);
        const overlay = createOverlay(spellMode, spellDraft.startGridX, spellDraft.startGridY, angle, shapeParams);
        addOverlay(overlay);
        setSpellDraft(null);
    }, [computeAngle]);

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
