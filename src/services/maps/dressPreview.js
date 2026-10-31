/**
 * AI Dress overlay-preview helpers (backlog ai-dress-belongs-in-map-view).
 *
 * Turns a dress PROPOSAL's raw ops (the same op list the modal preview list
 * renders) into cell-anchored markers the map view can draw over its own
 * grid, so "add throne at 10,2" is readable AGAINST the actual cells before
 * Apply. Pure derivation only — nothing here writes or calls the server.
 *
 * Honesty notes:
 * - The server validates every op against the LIVE document all-or-nothing,
 *   so an off-grid / unknown-id op can never arrive in a successful proposal.
 *   We still re-check bounds client-side (isInside) and flag violations with
 *   `valid: false` (a stale view or a future server relaxation shows up
 *   loudly instead of silently drawing off-canvas).
 * - remove/move cite row ids, not cells; their source cell comes from the
 *   CURRENT client document. An unresolvable id yields a coord-less marker —
 *   the overlay cannot anchor it, and the modal's text preview remains the
 *   honest surface for it.
 */
import { CELL_SIZE } from '../../config/mapConfig.js';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { hexKey, hexToPixel, hexToSVGPath } from './hexMapUtils.js';

const cellCoords = (row) => {
    if (!row) return null;
    if (Number.isInteger(row.q) && Number.isInteger(row.r)) return { x: row.q, y: row.r };
    if (Number.isInteger(row.gridX) && Number.isInteger(row.gridY)) return { x: row.gridX, y: row.gridY };
    return null;
};

// Plain-English label ladder. Items/POIs read best as type/label first
// (server dressMap.js idiom); tokens are identified by NAME — "monster"
// alone names nothing on the canvas.
const rowLabel = (row, target) => (target === 'token'
    ? row?.name || row?.type || 'row'
    : row?.type || row?.name || row?.label || 'row');

const addLabel = (op) => op.item?.type || op.token?.name || op.poi?.name || op.target;

function laneRows(doc, target) {
    const lane = target === 'item' ? doc?.placedItems : target === 'token' ? doc?.items : doc?.pois;
    return Array.isArray(lane) ? lane : [];
}

/**
 * @param {Array} ops    proposal op list ({op,target,id?,gridX?,gridY?,item?/poi?/token?})
 * @param {object} doc   the CURRENT client map document (lanes: placedItems/items/pois)
 * @param {{isInside?: (x:number,y:number)=>boolean}} [opts]
 * @returns {Array<{key:string, kind:'add'|'remove'|'move-from', x:number|null,
 *                  y:number|null, label:string, valid:boolean}>}
 *   A move op emits TWO markers: its amber source (move-from) and its cyan
 *   destination (kind 'add' with a `move … → x,y` label).
 */
export function buildDressMarkers(ops, doc, { isInside } = {}) {
    const markers = [];
    const check = isInside || (() => true);
    let seq = 0;
    const push = (m) => markers.push({ key: `${m.kind}-${seq++}`, valid: true, ...m });

    (ops || []).forEach((op) => {
        if (op.op === 'add') {
            const x = op.gridX;
            const y = op.gridY;
            const numeric = Number.isInteger(x) && Number.isInteger(y);
            push({
                kind: 'add',
                x: numeric ? x : null,
                y: numeric ? y : null,
                label: numeric ? `add ${addLabel(op)} at ${x},${y}` : `add ${addLabel(op)} (no cell)`,
                valid: numeric && check(x, y),
            });
            return;
        }
        const row = laneRows(doc, op.target).find(r => String(r?.id) === String(op.id));
        const from = cellCoords(row);
        if (!from) {
            push({ kind: 'remove', x: null, y: null, label: `remove ${op.id} (not on this view)`, valid: false });
            return;
        }
        if (op.op === 'remove') {
            push({ kind: 'remove', x: from.x, y: from.y, label: `remove ${rowLabel(row, op.target)} at ${from.x},${from.y}` });
            return;
        }
        // move: source highlight + destination marker reading the server's
        // `move <name> → x,y` preview idiom.
        push({ kind: 'move-from', x: from.x, y: from.y, label: '' });
        const numeric = Number.isInteger(op.gridX) && Number.isInteger(op.gridY);
        push({
            kind: 'add',
            x: numeric ? op.gridX : null,
            y: numeric ? op.gridY : null,
            label: numeric ? `move ${rowLabel(row, op.target)} → ${op.gridX},${op.gridY}` : `move ${rowLabel(row, op.target)} (no cell)`,
            valid: numeric && check(op.gridX, op.gridY),
        });
    });
    return markers;
}

/** Square-grid (indoor) pixel geometry: cellCenter uses the editor's own
 *  grid-center math so the markers track zoom/pan through the svg viewBox. */
export function squareDressGeometry(gridCenterX, gridCenterY, cellSize = CELL_SIZE) {
    return {
        cellCenter: (x, y) => ({ x: gridCenterX(x), y: gridCenterY(y) }),
        cellPath: ({ x, y }) =>
            `M${x - cellSize / 2},${y - cellSize / 2}h${cellSize}v${cellSize}h${-cellSize}Z`,
    };
}

/** Hex (outdoor) pixel geometry: q,r addressing through the shared hex utils. */
export function hexDressGeometry(size = HEX_SIZE) {
    return {
        cellCenter: (q, r) => hexToPixel(q, r, size),
        cellPath: ({ x, y }) => hexToSVGPath(x, y, size),
    };
}

/* ── Per-surface one-call wrappers (branch-free at the host components, which
   sit near the complexity cap): null ops / unloaded document → no markers. ── */

/** Indoor square grid: lanes are mapData(+placedItems); bounds 0..gridSize-1. */
export function indoorDressMarkers(ops, mapData, placedItems, gridSize) {
    if (!ops || !mapData) return null;
    return buildDressMarkers(ops, { ...mapData, placedItems }, {
        isInside: (x, y) => x >= 0 && y >= 0 && x < gridSize && y < gridSize,
    });
}

/** Outdoor hex: only the POI lane exists (item/token ops are indoor-only
    server-side); a cell exists iff its q,r terrain key does. */
export function hexDressMarkers(ops, { pois, terrain } = {}) {
    if (!ops) return null;
    return buildDressMarkers(ops, { pois }, {
        isInside: (q, r) => Boolean(terrain?.[hexKey(q, r)]),
    });
}
