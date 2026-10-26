import { useState, useCallback } from 'react';
import { CELL_SIZE } from '../../../config/mapConfig';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { onTokenMoveLanded } from '../../../services/combat/opportunityTrigger.js';

export default function useItemDragging({
    svgRef,
    placedItems,
    setPlacedItems,
    gridSize,
    gridCenterX,
    gridCenterY,
    rulerMode,
    spellMode,
    campaignName,
    mapData,
}) {
    const [itemDragging, setItemDragging] = useState(null);

    const handleItemPointerDown = useCallback((e, itemId) => {
        if (rulerMode || spellMode) return;
        e.stopPropagation();
        if (e.button !== 0) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const svgPt = pt.matrixTransform(ctm.inverse());

        const item = placedItems.find((i) => i.id === itemId);
        if (!item) return;

        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);

        // #883: capture only once the drag has verifiably started (house pattern:
        // useRuler.js guards, validates, then captures). Capturing before these
        // guards stranded the pointer on failed starts — up/leave bail on null
        // itemDragging, so release never ran and the implicit capture swallowed
        // every later click. itemDragging !== null now strictly implies a capture
        // attempt. Synthetic/assistive pointer events (evaluate-dispatched
        // PointerEvents, some AT input) carry no active pointer, so
        // setPointerCapture throws NotFoundError there. Swallow it: losing capture
        // only degrades event routing — it must not abort drag-start mid-tick.
        try {
            svg.setPointerCapture(e.pointerId);
        } catch (err) {
            console.debug('[useItemDragging] setPointerCapture failed (drag continues)', err);
        }

        setItemDragging({
            itemId,
            pointerId: e.pointerId,
            offsetX: svgPt.x - cx,
            offsetY: svgPt.y - cy,
            startGridX: item.gridX,
            startGridY: item.gridY,
            moverName: item.name || item.id,
            moverIsPlayer: item.type === 'player',
        });
    }, [rulerMode, spellMode, placedItems, gridCenterX, gridCenterY, svgRef]);

    const handleItemPointerMove = useCallback((e) => {
        if (!itemDragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const svgPt = pt.matrixTransform(ctm.inverse());

        const cx = svgPt.x - itemDragging.offsetX;
        const cy = svgPt.y - itemDragging.offsetY;

        const gridX = Math.floor(cx / CELL_SIZE);
        const gridY = Math.floor(cy / CELL_SIZE);

        const clampedGridX = Math.max(0, Math.min(gridSize - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(gridSize - 1, gridY));

        setPlacedItems((prev) => {
            const updatedItem = prev.find((item) => item.id === itemDragging.itemId);
            if (updatedItem) {
                const oldGridX = updatedItem.gridX;
                const oldGridY = updatedItem.gridY;
                if (campaignName && updatedItem.type === 'player' && (oldGridX !== clampedGridX || oldGridY !== clampedGridY)) {
                    setRuntimeValue(updatedItem.name || updatedItem.id, 'steadyAimMovedThisTurn', true, campaignName);
                }
            }
            return prev.map((item) =>
                item.id === itemDragging.itemId
                    ? { ...item, gridX: clampedGridX, gridY: clampedGridY }
                    : item
            );
        });
    }, [itemDragging, gridSize, setPlacedItems, svgRef, campaignName]);

    const handleItemPointerUp = useCallback((e) => {
        if (!itemDragging) return; // failed down never captured — bailing strands nothing
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);

        // L5-003 §8.4: NPC/player token dropped at a new cell — opportunity
        // trigger (synchronous zero-work while enforcement is off).
        const item = (placedItems || []).find((i) => i.id === itemDragging.itemId);
        if (
            campaignName && item &&
            Number.isFinite(itemDragging.startGridX) &&
            (item.gridX !== itemDragging.startGridX || item.gridY !== itemDragging.startGridY)
        ) {
            onTokenMoveLanded({
                campaignName,
                moverName: itemDragging.moverName || item.name || item.id,
                moverIsPlayer: !!itemDragging.moverIsPlayer,
                fromCell: { gridX: itemDragging.startGridX, gridY: itemDragging.startGridY },
                toCell: { gridX: item.gridX, gridY: item.gridY },
                mapData,
            }).catch((err) => { console.error('[useItemDragging:opportunity-trigger]', err); });
        }

        setItemDragging(null);
    }, [itemDragging, svgRef, campaignName, placedItems, mapData]);

    const handleItemPointerLeave = useCallback((e) => {
        if (!itemDragging) return;
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setItemDragging(null);
    }, [itemDragging, svgRef]);

    return {
        itemDragging,
        handleItemPointerDown,
        handleItemPointerMove,
        handleItemPointerUp,
        handleItemPointerLeave,
    };
}
