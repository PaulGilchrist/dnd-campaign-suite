import { useState, useCallback } from 'react';
import { CELL_SIZE } from '../../../config/mapConfig';
import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { computeMovementObstacles,
    computeReachable,
    findNearestValid,
} from '../../../services/maps/reachability.js';
import { clampMovementDrop } from '../../../services/combat/movementBudget.js';
import { DEFAULT_SPEED_FEET } from '../../../services/combat/turnState.js';
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
 * Returns { targetX, targetY, moveCostFeet, budgetActive }. Enforcement off,
 * no campaign, or GM Shift unconstrained ⇒ budgetActive:false and the drop
 * passes through untouched (the L1–4 guarantee). Snapped drops log a reason.
 */
function resolveMovementBudgetDrop({ dragging, targetX, targetY, player, mapData, walls, placedItems, gridSize, campaignName }) {
    const enforcement = campaignName ? getRuntimeValue('campaign', 'enforcement') : null;
    const passthrough = { targetX, targetY, moveCostFeet: 0, budgetActive: false };
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
    if (clamped.target.gridX !== targetX || clamped.target.gridY !== targetY) {
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
    return { targetX: outX, targetY: outY, moveCostFeet: clamped.costFeet, budgetActive: true };
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
        const reachable = unconstrained
            ? null
            : computeReachable(player.gridX, player.gridY, computeMovementObstacles(walls, placedItems), gridSize);

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
            // L5-002: mapData.players mutates live during pointermove, so the
            // turn-start cell must be captured at press time for budget clamping.
            startX: player.gridX,
            startY: player.gridY,
        });
    }, [rulerMode, spellMode, mapData, gridCenterX, gridCenterY, svgRef, isLocalhost, walls, placedItems, gridSize]);

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
            // cannot be lifted across walls or closed doors.
            const valid = dragging.reachable.has(`${clampedGridX},${clampedGridY}`);
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

        setMapData((prev) => ({
            ...prev,
            players: prev.players.map((c) =>
                c.id === dragging.playerId ? { ...c, gridX: targetX, gridY: targetY } : c
            )
        }));

        setDragging(null);

        finalizePlayerMove({ dragging, player, targetX, targetY, campaignName, budget, mapData });
    }, [dragging, mapData, gridSize, setMapData, svgRef, campaignName, walls, placedItems]);

    const handlePointerLeave = useCallback((e) => {
        if (!dragging) return;
        const svg = svgRef.current;
        if (svg) svg.releasePointerCapture(e.pointerId);
        setDragging(null);
    }, [dragging, svgRef]);

    return { dragging, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave };
}
