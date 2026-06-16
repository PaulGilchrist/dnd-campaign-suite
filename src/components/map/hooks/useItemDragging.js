import { useState, useCallback } from 'react';
import { CELL_SIZE } from '../../../config/mapConfig';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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
}) {
    const [itemDragging, setItemDragging] = useState(null);

    const handleItemPointerDown = useCallback((e, itemId) => {
        if (rulerMode || spellMode) return;
        e.stopPropagation();
        if (e.button !== 0) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;
        svg.setPointerCapture(e.pointerId);

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

        setItemDragging({
            itemId,
            pointerId: e.pointerId,
            offsetX: svgPt.x - cx,
            offsetY: svgPt.y - cy,
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
        if (!itemDragging) return;
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setItemDragging(null);
    }, [itemDragging, svgRef]);

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
