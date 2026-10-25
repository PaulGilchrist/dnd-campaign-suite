import { useState, useCallback } from 'react';
import { CELL_SIZE } from '../../../config/mapConfig';
import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { computeMovementObstacles,
    computeReachable,
    findNearestValid,
} from '../../../services/maps/reachability.js';
import { clampMovementDrop, reachableWithinBudget } from '../../../services/combat/movementBudget.js';
import { DEFAULT_SPEED_FEET, remainingMovement } from '../../../services/combat/turnState.js';
import { chargeMovement } from '../../../services/combat/chargeEconomy.js';
import { onTokenMoveLanded } from '../../../services/combat/opportunityTrigger.js';
import { addEntry } from '../../../services/ui/logService.js';

function toSvgPoint(svg, clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
}

function clampToGrid(v, gridSize) {
    return Math.max(0, Math.min(gridSize - 1, v));
}

function findFreeSquare(startX, startY, occupiedSquares, gridSize) {
    const found = findNearestValid(
        startX,
        startY,
        (x, y) => !occupiedSquares.has(`${x},${y}`),
        gridSize
    );
    return { targetX: found ? found.x : startX, targetY: found ? found.y : startY };
}

/**
 * L5-002 (§7.3): clamp a drop to the creature's remaining movement budget.
 * Returns { targetX, targetY, moveCostFeet, budgetActive, snapped, creatureName }.
 * Enforcement off, no campaign, or GM Shift unconstrained ⇒ budgetActive:false and
 * the drop passes through untouched (the L1–4 guarantee). Snapped drops log a
 * reason and report snapped:true so the board can surface the clamp visually
 * (the "snapped back" toast in Map.jsx) — UI-only fields, never persisted.
 */
function resolveMovementBudgetDrop({ dragging, targetX, targetY, player, mapData, walls, placedItems, gridSize, campaignName }) {
    const enforcement = campaignName ? getRuntimeValue('campaign', 'enforcement') : null;
    const passthrough = { targetX, targetY, moveCostFeet: 0, budgetActive: false, snapped: false, creatureName: null };
    if (!enforcement || enforcement.mode !== 'on' || !enforcement.movementBudget || dragging.unconstrained) {
        return passthrough;
    }
    const creatureName = player.name || player.id;
    const speedFeet = Number(player.speedFeet) > 0 ? Number(player.speedFeet) : DEFAULT_SPEED_FEET;
    const clamped = clampMovementDrop({
        turnState: getRuntimeValue('campaign', 'turnState') || {},
        creatureName,
        speedFeet,
        from: { gridX: dragging.startX, gridY: dragging.startY },
        to: { gridX: targetX, gridY: targetY },
        obstacles: computeMovementObstacles(walls, placedItems),
        terrain: mapData.terrain,
        gridSize,
    });
    let outX = targetX;
    let outY = targetY;
    let snapped = false;
    if (clamped.target.gridX !== targetX || clamped.target.gridY !== targetY) {
        snapped = true;
        addEntry(campaignName, {
            type: 'enforcement_denied',
            creature: creatureName,
            bucket: 'movement',
            source: 'map-drag',
            reason: `Out of movement — snapped to the remaining budget (${clamped.costFeet} ft this move).`,
        }).catch((e) => { console.error('[usePlayerDragging:movement-log]', e); });
        outX = clamped.target.gridX;
        outY = clamped.target.gridY;
    }
    return { targetX: outX, targetY: outY, moveCostFeet: clamped.costFeet, budgetActive: true, snapped, creatureName };
}

/**
 * Post-drop bookkeeping: Steady Aim's moved-this-turn stamp, the
 * movement-budget charge (budgetActive:false ⇒ no-op, enforcement off),
 * and the §8.4 opportunity-attack trigger (returns synchronously with
 * zero work while enforcement.opportunityAttacks is off).
 */
function finalizePlayerMove({ dragging, player, targetX, targetY, campaignName, budget, mapData }) {
    if (!campaignName || !player) return;
    const startGridX = dragging.startX ?? player.gridX;
    const startGridY = dragging.startY ?? player.gridY;
    if (startGridX === targetX && startGridY === targetY) return;
    setRuntimeValue(player.name || player.id, 'steadyAimMovedThisTurn', true, campaignName);
    if (budget.budgetActive) {
        chargeMovement({ creatureName: player.name || player.id, feet: budget.moveCostFeet, campaignName });
    }
    onTokenMoveLanded({
        campaignName,
        moverName: player.name || player.id,
        moverIsPlayer: true,
        fromCell: { gridX: startGridX, gridY: startGridY },
        toCell: { gridX: targetX, gridY: targetY },
        mapData,
    }).catch((e) => { console.error('[usePlayerDragging:opportunity-trigger]', e); });
}

/**
 * L5-002 persistence-race fix: press-time budget-pinned ghost region — the
 * cells this creature can still pay for this turn, or null when the lane is
 * inactive (enforcement off / no campaign / GM Shift unconstrained ⇒ the
 * drag lane stays byte-identical to pre-L5, the L1–4 guarantee).
 *
 * Raw over-budget ghost cells were reaching disk through autosave and the
 * save's own map-data SSE echo then overwrote the clamped pointerUp commit —
 * the snap billed + logged while the token persisted past budget. Gating the
 * live move to this set keeps EVERY persistence lane legal; the press-time
 * snapshot is intentional: mid-drag turnState churn is re-adjudicated at
 * drop by resolveMovementBudgetDrop, which stays the billing/logging
 * authority (snapToBudget cells are a subset of this same-budget BFS region,
 * so the drop-side clamped write is always inside the pinned region too).
 */
function pressBudgetRegion({ campaignName, unconstrained, player, obstacles, mapData, gridSize }) {
    if (unconstrained || !campaignName) return null;
    const enforcement = getRuntimeValue('campaign', 'enforcement');
    if (!enforcement || enforcement.mode !== 'on' || !enforcement.movementBudget) return null;
    return reachableWithinBudget({
        from: { gridX: player.gridX, gridY: player.gridY },
        obstacles,
        terrain: mapData.terrain,
        gridSize,
        budgetFeet: remainingMovement(
            getRuntimeValue('campaign', 'turnState') || {},
            player.name || player.id,
            Number(player.speedFeet) > 0 ? Number(player.speedFeet) : DEFAULT_SPEED_FEET,
        ),
    });
}

export default function usePlayerDragging({
    svgRef,
    mapData,
    gridSize,
    setMapData,
    gridCenterX,
    gridCenterY,
    rulerMode,
    spellMode,
    campaignName,
    isLocalhost,
    walls,
    placedItems,
}) {
    const [dragging, setDragging] = useState(null);
    // Enforcement snap-back visibility (backlog 2026-10-25): the drop-side clamp
    // repositions the token onto the snapped cell — silent reverts read as the
    // drag "sticking", so surface a plain-English toast naming the creature and
    // the budget it landed on. Display-only: mirrors the MusicPlayer toast
    // pattern (state + auto-hide timer, no game state on the clock).
    const [snapToast, setSnapToast] = useState(null);

    const showSnapToast = useCallback((message) => {
        setSnapToast({ id: Date.now(), message });
        setTimeout(() => setSnapToast(null), 2500); // toast auto-hide (display only, no game state)
    }, []);

    const handlePointerDown = useCallback((e, playerId) => {
        if (rulerMode || spellMode) return;
        e.stopPropagation();
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;

        const svgPt = toSvgPoint(svg, e.clientX, e.clientY);
        if (!svgPt) return;

        const player = mapData.players.find((c) => c.id === playerId);
        if (!player) return;

        const cx = gridCenterX(player.gridX);
        const cy = gridCenterY(player.gridY);

        // The GM can hold Shift to bypass the walkable-cell constraint
        // (narrative teleports); everyone else may only drag the token
        // through cells it could actually walk through.
        const unconstrained = Boolean(isLocalhost && e.shiftKey);
        const obstacles = computeMovementObstacles(walls, placedItems);
        const reachable = unconstrained
            ? null
            : computeReachable(player.gridX, player.gridY, obstacles, gridSize);

        // L5-002: movement-budget pinned region (null ⇒ enforcement off).
        const budgetReachable = pressBudgetRegion({ campaignName, unconstrained, player, obstacles, mapData, gridSize });

        // #910: capture only once the drag has verifiably started (house pattern:
        // useRuler.js guards, validates, then captures; mirrors the #883 fix in
        // useItemDragging.js). Capturing before the ctm/player guards stranded the
        // pointer on failed starts — up/leave bail on null dragging, so release never
        // ran and the implicit capture swallowed every later click. dragging !== null
        // now strictly implies captured.
        svg.setPointerCapture(e.pointerId);

        setDragging({
            playerId,
            pointerId: e.pointerId,
            offsetX: svgPt.x - cx,
            offsetY: svgPt.y - cy,
            unconstrained,
            reachable,
            // L5-002: budget-pinned ghost cells (null ⇒ enforcement off).
            budgetReachable,
            // L5-002: mapData.players mutates live during pointermove, so the
            // turn-start cell must be captured at press time for budget clamping.
            startX: player.gridX,
            startY: player.gridY,
        });
    }, [rulerMode, spellMode, mapData, gridCenterX, gridCenterY, svgRef, isLocalhost, walls, placedItems, gridSize, campaignName]);

    const handlePointerMove = useCallback((e) => {
        if (!dragging) return;
        e.preventDefault();

        const svg = svgRef.current;
        if (!svg) return;

        const svgPt = toSvgPoint(svg, e.clientX, e.clientY);
        if (!svgPt) return;

        const player = mapData.players.find((c) => c.id === dragging.playerId);
        if (!player) return;

        const cx = svgPt.x - dragging.offsetX;
        const cy = svgPt.y - dragging.offsetY;

        const clampedGridX = clampToGrid(Math.floor(cx / CELL_SIZE), gridSize);
        const clampedGridY = clampToGrid(Math.floor(cy / CELL_SIZE), gridSize);

        if (!dragging.unconstrained) {
            // Keep the token inside its walkable region so the fog of war
            // cannot be lifted across walls or closed doors. On the L5-002
            // enforcement lane the region is additionally intersected with the
            // cells its remaining speed can pay for (budgetReachable) — a RAW
            // over-budget commit would ride autosave to disk and its SSE echo
            // would overwrite the clamped pointerUp write (the token persisting
            // past budget while the log claims a snap).
            const key = `${clampedGridX},${clampedGridY}`;
            const valid = dragging.reachable.has(key)
                && (!dragging.budgetReachable || dragging.budgetReachable.has(key));
            if (!valid) {
                setDragging((prev) => (prev && !prev.invalid ? { ...prev, invalid: true } : prev));
                return;
            }
            if (dragging.invalid) {
                setDragging((prev) => (prev && prev.invalid ? { ...prev, invalid: false } : prev));
            }
        }

        setMapData((prev) => ({
            ...prev,
            players: prev.players.map((c) =>
                c.id === dragging.playerId ? { ...c, gridX: clampedGridX, gridY: clampedGridY } : c
            )
        }));
    }, [dragging, mapData, gridSize, setMapData, svgRef]);

    const handlePointerUp = useCallback((e) => {
        if (!dragging) return; // failed down never captured — bailing strands nothing (#910)
        e.preventDefault();

        // #910 capture discipline (mirrors the #883 fix in useItemDragging.js:
        // release-first in up): dragging !== null strictly implies captured (down
        // captures only after its guards), so release runs BEFORE the ctm/player
        // guards below — a guarded up must never strand the held capture. Pointer
        // capture routes the captured pointer's later events to the capturing
        // element carrying that pointer's own id, so e.pointerId here is the id
        // held since down; releasing it drops exactly that hold.
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);

        const svgPt = toSvgPoint(svg, e.clientX, e.clientY);
        if (!svgPt) { setDragging(null); return; }

        const player = mapData.players.find((c) => c.id === dragging.playerId);
        if (!player) {
            setDragging(null);
            return;
        }

        const cx = svgPt.x - dragging.offsetX;
        const cy = svgPt.y - dragging.offsetY;

        const clampedGridX = clampToGrid(Math.floor(cx / CELL_SIZE), gridSize);
        const clampedGridY = clampToGrid(Math.floor(cy / CELL_SIZE), gridSize);

        // Collision detection: find the nearest unoccupied grid square
        const occupiedSquares = new Set(
            mapData.players
                .filter((c) => c.id !== dragging.playerId)
                .map((c) => `${c.gridX},${c.gridY}`)
        );

        let targetX;
        let targetY;
        if (dragging.unconstrained) {
            ({ targetX, targetY } = findFreeSquare(clampedGridX, clampedGridY, occupiedSquares, gridSize));
        } else {
            // The drop must be a cell the player could walk to: reachable
            // from where the drag started, not a wall or closed door, and
            // unoccupied. Otherwise snap to the nearest such cell, falling
            // back to the player's current cell if none exists.
            const found = findNearestValid(
                clampedGridX,
                clampedGridY,
                (x, y) => dragging.reachable.has(`${x},${y}`) && !occupiedSquares.has(`${x},${y}`),
                gridSize
            );
            targetX = found ? found.x : player.gridX;
            targetY = found ? found.y : player.gridY;
        }

        // L5-002: clamp the drop to the movement budget (budgetActive:false ⇒
        // passthrough — enforcement off is byte-identical to today).
        const budget = resolveMovementBudgetDrop({ dragging, targetX, targetY, player, mapData, walls, placedItems, gridSize, campaignName });
        targetX = budget.targetX;
        targetY = budget.targetY;
        // Visual counterpart of the enforcement_denied log: the token lands on
        // the snapped cell, so say so before it reads as a stuck drag.
        if (budget.snapped) {
            showSnapToast(`${budget.creatureName} snapped back to ${budget.moveCostFeet} ft of movement.`);
        }

        setMapData((prev) => ({
            ...prev,
            players: prev.players.map((c) =>
                c.id === dragging.playerId ? { ...c, gridX: targetX, gridY: targetY } : c
            )
        }));

        setDragging(null);

        finalizePlayerMove({ dragging, player, targetX, targetY, campaignName, budget, mapData });
    }, [dragging, mapData, gridSize, setMapData, svgRef, campaignName, walls, placedItems, showSnapToast]);

    const handlePointerLeave = useCallback((e) => {
        if (!dragging) return;
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setDragging(null);
    }, [dragging, svgRef]);

    return { dragging, snapToast, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave };
}
