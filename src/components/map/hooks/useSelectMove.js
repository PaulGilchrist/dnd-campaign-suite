import { useState, useCallback, useRef } from 'react';
import { TOOL_SELECT } from '../../../config/mapConfig';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function collectWallsInRect(walls, rect) {
    const { minX, maxX, minY, maxY } = rect;
    const selected = new Set();
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const key = `${x},${y}`;
            if (walls.has(key)) selected.add(key);
        }
    }
    return selected;
}

function collectItemsInRect(items, rect) {
    const { minX, maxX, minY, maxY } = rect;
    const selected = new Set();
    for (const item of items) {
        if (item.gridX >= minX && item.gridX <= maxX &&
            item.gridY >= minY && item.gridY <= maxY) {
            selected.add(item.id);
        }
    }
    return selected;
}

function offsetBounds(bounds, dx, dy) {
    if (!bounds) return null;
    return {
        minX: bounds.minX + dx,
        maxX: bounds.maxX + dx,
        minY: bounds.minY + dy,
        maxY: bounds.maxY + dy,
    };
}

function shiftKeys(keys, dx, dy) {
    const shifted = new Set();
    for (const key of keys) {
        const [x, y] = key.split(',').map(Number);
        shifted.add(`${x + dx},${y + dy}`);
    }
    return shifted;
}

function buildMovedWalls(prev, selWalls, dstBounds, offset) {
    const newWalls = new Set(prev.walls);
    if (dstBounds) {
        for (let y = dstBounds.minY; y <= dstBounds.maxY; y++) {
            for (let x = dstBounds.minX; x <= dstBounds.maxX; x++) {
                newWalls.delete(`${x},${y}`);
            }
        }
    }
    for (const key of selWalls) {
        newWalls.delete(key);
    }
    for (const shifted of shiftKeys(selWalls, offset.dx, offset.dy)) {
        newWalls.add(shifted);
    }
    return { ...prev, walls: newWalls };
}

function useSelectMove({ isLocalhost, tool, getGridFromEvent, svgRef, campaignName }) {
    const [selectionRect, setSelectionRect] = useState(null);
    const [selectedWalls, setSelectedWalls] = useState(new Set());
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [moveOffset, setMoveOffset] = useState(null);

    const selectedWallsRef = useRef(new Set());
    const selectedItemsRef = useRef(new Set());
    const selectStart = useRef(null);
    const moveStartGrid = useRef(null);
    const moveOffsetRef = useRef(null);
    const selectionRectRef = useRef(null);
    const selectionBoundsRef = useRef(null);
    const placedItemsRef = useRef([]);
    const mapDataRef = useRef(null);

    const handleSelectPointerDown = useCallback((e, _placedItems, _mapData) => {
        if (!isLocalhost || tool !== TOOL_SELECT) return;
        e.preventDefault();
        const svg = svgRef.current;
        if (svg) svg.setPointerCapture(e.pointerId);
        const grid = getGridFromEvent(e);
        if (!grid) return;
        const gx = Math.floor(grid.gridX);
        const gy = Math.floor(grid.gridY);

        const key = `${gx},${gy}`;
        const curSelWalls = selectedWallsRef.current;
        const curSelItems = selectedItemsRef.current;
        const curPlaced = placedItemsRef.current;

        const onSelectedWall = curSelWalls.has(key);
        const onSelectedItem = curSelItems.size > 0 && curPlaced.some(
            it => curSelItems.has(it.id) && it.gridX === gx && it.gridY === gy
        );
        const selBounds = selectionBoundsRef.current;
        const withinBounds = selBounds &&
            gx >= selBounds.minX && gx <= selBounds.maxX &&
            gy >= selBounds.minY && gy <= selBounds.maxY;

        if ((onSelectedWall || onSelectedItem || withinBounds) && (curSelWalls.size > 0 || curSelItems.size > 0)) {
            moveStartGrid.current = { gridX: gx, gridY: gy };
            moveOffsetRef.current = { dx: 0, dy: 0 };
            setMoveOffset({ dx: 0, dy: 0 });
            selectStart.current = null;
        } else {
            selectStart.current = { gridX: gx, gridY: gy };
            setSelectionRect({ minX: gx, maxX: gx, minY: gy, maxY: gy });
            setSelectedWalls(new Set());
            setSelectedItems(new Set());
            setMoveOffset(null);
            moveStartGrid.current = null;
            moveOffsetRef.current = null;
            selectionBoundsRef.current = null;
        }
    }, [isLocalhost, tool, getGridFromEvent, svgRef]);

    const handleSelectPointerMove = useCallback((e) => {
        if (!isLocalhost || tool !== TOOL_SELECT) return;
        const grid = getGridFromEvent(e);
        if (!grid) return;
        const gx = Math.floor(grid.gridX);
        const gy = Math.floor(grid.gridY);

        if (selectStart.current) {
            e.preventDefault();
            const rect = {
                minX: Math.min(selectStart.current.gridX, gx),
                maxX: Math.max(selectStart.current.gridX, gx),
                minY: Math.min(selectStart.current.gridY, gy),
                maxY: Math.max(selectStart.current.gridY, gy),
            };
            selectionRectRef.current = rect;
            setSelectionRect(rect);
        } else if (moveStartGrid.current) {
            e.preventDefault();
            const dx = gx - moveStartGrid.current.gridX;
            const dy = gy - moveStartGrid.current.gridY;
            moveOffsetRef.current = { dx, dy };
            setMoveOffset({ dx, dy });
        }
    }, [isLocalhost, tool, getGridFromEvent]);

    const applySelectionMove = useCallback((offset, setMapData, setPlacedItems) => {
        const curSelWalls = selectedWallsRef.current;
        const curSelItems = selectedItemsRef.current;
        const bounds = selectionBoundsRef.current;
        const dstBounds = offsetBounds(bounds, offset.dx, offset.dy);

        setMapData(prev => buildMovedWalls(prev, curSelWalls, dstBounds, offset));
        setSelectedWalls(prev => shiftKeys(prev, offset.dx, offset.dy));

        if (bounds) {
            selectionBoundsRef.current = offsetBounds(bounds, offset.dx, offset.dy);
        }

        setPlacedItems(prev =>
            prev.map(item => {
                if (!curSelItems.has(item.id)) return item;
                // Track movement for Steady Aim
                if (campaignName && item.type === 'player') {
                    setRuntimeValue(item.name || item.id, 'steadyAimMovedThisTurn', true, campaignName);
                }
                return { ...item, gridX: item.gridX + offset.dx, gridY: item.gridY + offset.dy };
            })
        );
    }, [campaignName]);

    const handleSelectPointerUp = useCallback((e, placedItems, mapData, setMapData, setPlacedItems) => {
        if (!isLocalhost) return;
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);

        if (selectStart.current) {
            const rect = selectionRectRef.current;
            if (rect) {
                const walls = mapDataRef.current?.walls || new Set();
                const items = placedItemsRef.current || [];
                setSelectedWalls(collectWallsInRect(walls, rect));
                setSelectedItems(collectItemsInRect(items, rect));
                selectionBoundsRef.current = { minX: rect.minX, maxX: rect.maxX, minY: rect.minY, maxY: rect.maxY };
            }
            selectStart.current = null;
            selectionRectRef.current = null;
            setSelectionRect(null);
            return;
        }

        if (!moveStartGrid.current) return;
        const offset = moveOffsetRef.current;
        if (offset && (offset.dx !== 0 || offset.dy !== 0)) {
            applySelectionMove(offset, setMapData, setPlacedItems);
        }
        moveStartGrid.current = null;
        moveOffsetRef.current = null;
        setMoveOffset(null);
    }, [isLocalhost, svgRef, applySelectionMove]);

    return {
        selectionRect, selectedWalls, selectedItems, moveOffset,
        selectedWallsRef, selectedItemsRef, selectStart, moveStartGrid,
        moveOffsetRef, selectionRectRef, selectionBoundsRef, placedItemsRef, mapDataRef,
        handleSelectPointerDown, handleSelectPointerMove, handleSelectPointerUp,
    };
}

export default useSelectMove;
