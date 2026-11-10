import { CELL_SIZE } from '../../config/mapConfig';

/**
 * Same-cell token stacking (backlog GA 2026-11-10: overlapping tokens made
 * drags ambiguous — two tokens at one grid coord rendered exactly on top of
 * each other and the pointer grabbed purely by paint order, so a cell-stepped
 * sequence silently alternated movers mid-sequence).
 *
 * Law: every token sharing a cell fans out diagonally toward the top-left by
 * a deterministic micro-offset — the LAST-painted token (the visually topmost
 * one, i.e. exactly the token SVG hit-testing grabs on overlap) stays pinned
 * at the cell centre and each earlier-painted token shifts one more step back.
 * Mirrors the map-view/initiative-card stacking idiom: each token visibly
 * peeks out, its visible sliver is its own grab surface, and the token you
 * can SEE under the pointer is always the token that MOVES.
 *
 * Paint order is the contract this derivation must match, bottom → top:
 *   1. the whole Players layer (mapData.players, array order) renders before
 *      the whole PlacedItems layer (Map.jsx), so a player token is always
 *      BELOW a creature placedItem on the same cell;
 *   2. within PlacedItems, renderCreature dispatches 'monster' rows before
 *      'npc' rows (its per-type renderItems passes).
 *
 * A cell with a single token yields NO offset entry, and the stack-top token
 * of any stack is {dx:0,dy:0} — so single-token cells render byte-unchanged.
 * The token currently being dragged is excluded (it rides the pointer at the
 * true cell centre and its buried siblings re-centre the moment it lifts).
 */
export const STACK_OFFSET_PX = CELL_SIZE / 4; // 10px on the 40px cell
export const MAX_STACK_OFFSET_STEPS = 2; // caps the fan inside one cell + margin

// placedItem creature-token types (props/doors/POIs are out of scope — the
// GA ambiguity was tokens grabbing each other).
const CREATURE_ITEM_TYPES = ['monster', 'npc'];

function finiteTokens(list, layer, draggedId) {
    return (list || [])
        .filter(t => t.id != null && t.id !== draggedId
            && Number.isFinite(t.gridX) && Number.isFinite(t.gridY))
        .map(t => ({ ...t, layer }));
}

/**
 * Entries in EXACTLY the SVG paint order (bottom → top) so the stack order is
 * stable across re-renders and consistent with what hit-testing will grab.
 */
function paintedTokens(mapData, placedItems, draggedPlayerId, draggedItemId) {
    const players = finiteTokens(mapData?.players, 'players', draggedPlayerId);
    // renderItems() filters by type, so every monster paints before every npc.
    const creatures = CREATURE_ITEM_TYPES.flatMap(type =>
        finiteTokens(
            (placedItems || []).filter(i => i.type === type),
            'items',
            draggedItemId
        )
    );
    return [...players, ...creatures];
}

/**
 * Returns { players: Map<playerId,{dx,dy}>, items: Map<itemId,{dx,dy}> }.
 * Only multi-token cells get entries; the stack top is always {dx:0,dy:0}.
 */
export function buildTokenStackOffsets({ mapData, placedItems, dragging, itemDragging }) {
    const offsets = { players: new Map(), items: new Map() };
    const byCell = new Map();
    for (const token of paintedTokens(mapData, placedItems, dragging?.playerId, itemDragging?.itemId)) {
        const key = `${token.gridX},${token.gridY}`;
        const cell = byCell.get(key);
        if (cell) cell.push(token);
        else byCell.set(key, [token]);
    }
    for (const cell of byCell.values()) {
        if (cell.length < 2) continue;
        const top = cell.length - 1;
        cell.forEach((token, index) => {
            const steps = Math.min(top - index, MAX_STACK_OFFSET_STEPS);
            // steps === 0 pins +0 (never -0) so stack tops match the identity
            // offset by value — and render with no transform attribute.
            const shift = steps > 0 ? -steps * STACK_OFFSET_PX : 0;
            offsets[token.layer].set(token.id, { dx: shift, dy: shift });
        });
    }
    return offsets;
}

/**
 * Render seam: the SVG transform string for a stacked token, or undefined so
 * the attribute is ABSENT (single-token cells stay byte-unchanged, and the
 * stack top pins the exact cell centre it already rendered at).
 */
export function tokenStackTransform(offsets, id) {
    const offset = offsets && offsets.get(id);
    if (!offset || (!offset.dx && !offset.dy)) return undefined;
    return `translate(${offset.dx}, ${offset.dy})`;
}

/**
 * Crowded-cell test (an entry EXISTS in the map ⇒ shares its cell, including
 * the centred stack top). Placed creature tokens answer this to swap their
 * full-cell transparent grab RECT for a circle matching their painted art:
 * a shifted rect's transparent corners would invisibly steal presses from
 * pixels where another token is what the user SEES (the GA ambiguity this
 * module exists to kill). With painted-shape = hit-shape on crowded cells,
 * SVG paint order makes the visually topmost token under the pointer exactly
 * the token that captures the press. Single tokens keep their rect
 * byte-unchanged.
 */
export function isStackedToken(offsets, id) {
    return !!(offsets && offsets.has(id));
}
