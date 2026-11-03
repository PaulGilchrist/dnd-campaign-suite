import { useCallback } from 'react';
import utils from '../../../services/ui/utils';
import { computeMovementObstacles, findNearestValid } from '../../../services/maps/reachability.js';

// Palette types that carry an explicit rotation of 0 when dropped (ItemsPanel.jsx).
const ROTATABLE_TYPES = new Set(['table', 'bed', 'stairs', 'altar', 'bookshelf', 'torch', 'chair', 'arrowSlitWall']);

// Grid-bounds clamp (backlog 2026-11-03 CK): mirrors the pointer-drag seams —
// usePlayerDragging.js clampToGrid and useItemDragging.js:93-94 both snap
// out-of-grid drops to the nearest edge cell of the gridSize×gridSize board.
// Invalid gridSize passes the coord through untouched (same guard family as
// reachability.js:29/:63) so a broken board can never poison finite cells
// into NaN through Math.min.
function clampToGrid(v, gridSize) {
    if (!Number.isFinite(gridSize) || gridSize < 1) return v;
    return Math.max(0, Math.min(gridSize - 1, v));
}

function useMapDrops({ isLocalhost, getGridFromEvent, setMapData, setPlacedItems, placedItems, gridSize }) {
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const grid = getGridFromEvent(e);
        if (!grid) return;
        // Numeric law (fix#121): drop coords are event math (useZoomPan.js:43-46
        // divides clientToSVG output by CELL_SIZE) — non-finite gridX/gridY means
        // the math failed. Loud + refuse, never persist NaN/Infinity cells
        // (same family as the Number.isFinite gate in useItemDragging.js:111).
        if (!Number.isFinite(grid.gridX) || !Number.isFinite(grid.gridY)) {
            console.error(`useMapDrops: refusing drop at non-finite grid coords (${grid.gridX}, ${grid.gridY})`);
            return;
        }
        // Strict-presence law (fix#39): trim before presence so a whitespace-only
        // payload ('   ' is truthy) never persists as a phantom furniture item with
        // type:'   ' through the useMapLoader autosave to disk. Illegal payloads
        // refuse silent, mirroring the drop-seam family (HexMap.jsx:331,:345).
        const dragData = e.dataTransfer.getData('text/plain');
        if (!String(dragData ?? '').trim()) return;
        // Grid-bounds law (fix for backlog 2026-11-03 CK): the drop seam must
        // never persist cells outside the board. Clamp to the nearest edge cell
        // — the same relocation the pointer-drag lanes already do — and log the
        // correction loudly, mirroring the fix#121 numeric-law gate above. Runs
        // AFTER the presence gate so illegal payloads stay refuse-silent.
        const rawX = Math.floor(grid.gridX);
        const rawY = Math.floor(grid.gridY);
        const gx = clampToGrid(rawX, gridSize);
        const gy = clampToGrid(rawY, gridSize);
        if (gx !== rawX || gy !== rawY) {
            console.error(`useMapDrops: clamped out-of-grid drop (${rawX}, ${rawY}) to (${gx}, ${gy})`);
        }

        if (dragData.startsWith('character:')) {
            const charName = dragData.slice('character:'.length);
            // Same-class guard: 'character:' / 'character:   ' carry no name —
            // refuse silent rather than persist a nameless phantom player.
            if (!charName.trim()) return;
            setMapData(prev => {
                const existing = prev.players || [];
                if (existing.some(p => p.name === charName)) return prev;
                // A new player must start on a passable cell: if the drop
                // lands on a wall or closed door, snap to the nearest
                // passable cell instead.
                const obstacles = computeMovementObstacles(prev.walls, placedItems);
                let targetX = gx;
                let targetY = gy;
                if (obstacles.has(`${gx},${gy}`)) {
                    const found = findNearestValid(gx, gy, (x, y) => !obstacles.has(`${x},${y}`), gridSize);
                    if (found) {
                        targetX = found.x;
                        targetY = found.y;
                    }
                }
                return {
                    ...prev,
                    players: [...existing, {
                        id: charName.toLowerCase().replace(/\s+/g, '-'),
                        name: charName,
                        gridX: targetX,
                        gridY: targetY,
                    }],
                };
            });
            return;
        }

        if (dragData === 'npc') {
            const newItem = {
                id: utils.guid(),
                type: 'npc',
                gridX: gx,
                gridY: gy,
                visible: isLocalhost,
                name: 'NPC',
            };
            setPlacedItems(prev => [...prev, newItem]);
            return;
        }

        const newItem = {
            id: utils.guid(),
            type: dragData,
            gridX: gx,
            gridY: gy,
            visible: isLocalhost,
            rotation: ROTATABLE_TYPES.has(dragData) ? 0 : undefined,
        };
        setPlacedItems(prev => [...prev, newItem]);
    }, [isLocalhost, getGridFromEvent, setMapData, setPlacedItems, placedItems, gridSize]);

    return { handleDrop };
}

export default useMapDrops;
