import { useState, useCallback, useRef } from 'react';
import { TOOL_SELECT } from '../../../config/mapConfig';
import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { clampSelectionOffset, FEET_PER_CELL } from '../../../services/combat/movementBudget.js';
import { remainingMovement, DEFAULT_SPEED_FEET } from '../../../services/combat/turnState.js';
import { chargeMovement } from '../../../services/combat/chargeEconomy.js';
import { onTokenMoveLanded } from '../../../services/combat/opportunityTrigger.js';

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

/**
 * L5-002 (§7.3): clamp a rigid multi-select offset to the MINIMUM remaining
 * movement budget across the selected player tokens. Returns { dx, dy,
 * costFeet, budgetActive }. Enforcement off / no players selected ⇒
 * budgetActive:false with the offset unchanged (the L1–4 guarantee).
 */
function clampSelectOffset(offset, selectedPlayers, campaignName) {
    const direct = { dx: offset.dx, dy: offset.dy, costFeet: (Math.abs(offset.dx) + Math.abs(offset.dy)) * FEET_PER_CELL, budgetActive: false };
    const enforcement = campaignName ? getRuntimeValue('campaign', 'enforcement') : null;
    if (!enforcement || enforcement.mode !== 'on' || !enforcement.movementBudget || selectedPlayers.length === 0) {
        return direct;
    }
    const ts = getRuntimeValue('campaign', 'turnState') || {};
    const budgets = selectedPlayers.map(it =>
        remainingMovement(ts, it.name || it.id, Number(it.speedFeet) > 0 ? Number(it.speedFeet) : DEFAULT_SPEED_FEET)
    );
    const clamped = clampSelectionOffset({ dx: offset.dx, dy: offset.dy, minBudgetFeet: Math.min(...budgets) });
    return { dx: clamped.dx, dy: clamped.dy, costFeet: clamped.costFeet, budgetActive: true };
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
        // L5-002: rigid multi-select clamp to the group's minimum movement
        // budget (budgetActive:false ⇒ offset unchanged, enforcement off).
        const selectedPlayers = (placedItemsRef.current || []).filter(
            it => selectedItemsRef.current.has(it.id) && it.type === 'player'
        );
        const { dx, dy, costFeet, budgetActive } = clampSelectOffset(offset, selectedPlayers, campaignName);
        if (budgetActive && dx === 0 && dy === 0) return; // nothing fits the budget — group stays put

        const curSelWalls = selectedWallsRef.current;
        const curSelItems = selectedItemsRef.current;
        const bounds = selectionBoundsRef.current;
        const dstBounds = offsetBounds(bounds, dx, dy);

        setMapData(prev => buildMovedWalls(prev, curSelWalls, dstBounds, { dx, dy }));
        setSelectedWalls(prev => shiftKeys(prev, dx, dy));

        if (bounds) {
            selectionBoundsRef.current = offsetBounds(bounds, dx, dy);
        }

        setPlacedItems(prev =>
            prev.map(item => {
                if (!curSelItems.has(item.id)) return item;
                // Track movement for Steady Aim
                if (campaignName && item.type === 'player') {
                    setRuntimeValue(item.name || item.id, 'steadyAimMovedThisTurn', true, campaignName);
                }
                return { ...item, gridX: item.gridX + dx, gridY: item.gridY + dy };
            })
        );

        // Charge movement once per selected player token, on drop (no-op off).
        if (budgetActive && costFeet > 0) {
            for (const it of selectedPlayers) {
                chargeMovement({ creatureName: it.name || it.id, feet: costFeet, campaignName });
            }
        }

        // L5-003 §8.4: opportunity-attack trigger per moved token (returns
        // synchronously with zero work while enforcement is off).
        const mapNow = mapDataRef.current || {};
        const movedTokens = (placedItemsRef.current || []).filter(it => selectedItemsRef.current.has(it.id));
        for (const it of movedTokens) {
            onTokenMoveLanded({
                campaignName,
                moverName: it.name || it.id,
                moverIsPlayer: it.type === 'player',
                fromCell: { gridX: it.gridX, gridY: it.gridY },
                toCell: { gridX: it.gridX + dx, gridY: it.gridY + dy },
                mapData: mapNow,
            }).catch((e) => { console.error('[useSelectMove:opportunity-trigger]', e); });
        }
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
