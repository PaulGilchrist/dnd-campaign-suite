import { useState, useCallback } from 'react';

const CELL_SIZE = 40;

export default function useItemDragging({
    svgRef,
    placedItems,
    setPlacedItems,
    gridSize,
    gridCenterX,
    gridCenterY,
}) {
    const [itemDragging, setItemDragging] = useState(null);

    const handleItemPointerDown = useCallback((e, itemId) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;

        const item = placedItems.find((i) => i.id === itemId);
        if (!item) return;

        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);

        setItemDragging({
            itemId,
            offsetX: svgX - cx,
            offsetY: svgY - cy,
        });
    }, [placedItems, gridCenterX, gridCenterY, svgRef]);

    const handleItemPointerMove = useCallback((e) => {
        if (!itemDragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;

        const cx = svgX - itemDragging.offsetX;
        const cy = svgY - itemDragging.offsetY;

        const gridX = Math.floor(cx / CELL_SIZE);
        const gridY = Math.floor(cy / CELL_SIZE);

        const clampedGridX = Math.max(0, Math.min(gridSize - 1, gridX));
        const clampedGridY = Math.max(0, Math.min(gridSize - 1, gridY));

        setPlacedItems((prev) =>
            prev.map((item) =>
                item.id === itemDragging.itemId
                    ? { ...item, gridX: clampedGridX, gridY: clampedGridY }
                    : item
            )
        );
    }, [itemDragging, gridSize, setPlacedItems, svgRef]);

    const handleItemPointerUp = useCallback(() => {
        if (!itemDragging) return;
        setItemDragging(null);
    }, [itemDragging]);

    const handleItemPointerLeave = useCallback(() => {
        setItemDragging(null);
    }, []);

    return {
        itemDragging,
        handleItemPointerDown,
        handleItemPointerMove,
        handleItemPointerUp,
        handleItemPointerLeave,
    };
}
