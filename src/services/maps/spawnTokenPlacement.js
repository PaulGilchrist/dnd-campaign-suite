/**
 * Pure placement math for the quick-spawn map-token stamp (2026-11-20 CCC
 * backlog): a quick-spawned monster joins the Initiative board but gets no
 * `placedItems` token, so its range/cover lane silently degrades to leniency.
 * The opt-in stamp writes ONE `placedItems` row per spawned instance through
 * the legitimate GM map-document lane (mapsService.saveMapData); this module
 * owns only the deterministic cell/name arithmetic so every law is unit-
 * testable without fetches:
 *
 *  - Party-relative anchor: the rounded centroid of the indoor map's
 *    `players[]` tokens (the party's position). No party tokens ⇒ grid centre.
 *    Outdoor hex boards carry `partyPosition` as `{q,r}` hex coords and have
 *    NO grid-token lane at all — the caller skips them; that is why only
 *    indoor documents reach this module.
 *  - Preferred cell: a small fixed offset (2 cells along +x) from the anchor,
 *    mirroring the staging lane's spawn-zone discipline (itemPlacer.js tries
 *    a fixed offset list and takes the first free cell — same doctrine,
 *    deterministic ring order instead of rng).
 *  - Never on an occupied cell: every `players[]` and `placedItems` cell is
 *    blocked, and cells drawn earlier in the SAME batch stay blocked, so two
 *    goblins from one spawn never stack.
 *  - Clamped inside the grid; scan is a Chebyshev ring walk (radius-bounded,
 *    dx-then-dy tie order) so the "next free cell" is fully deterministic.
 *  - Row shape matches the owner map fixtures and the staging lane:
 *    `{ id, type:'npc', name, gridX, gridY, visible:true }`; the token name is
 *    EXACTLY the Initiative board name (quantity-suffix law owned by the
 *    join lane — the caller predicts via its own exported numbering helpers).
 */

export const SPAWN_TOKEN_PREFERRED_OFFSET = { dx: 2, dy: 0 };
export const SPAWN_TOKEN_SCAN_RADIUS = 4;

const cellKey = (x, y) => `${x},${y}`;
const hasCoord = (token) => Number.isFinite(token?.gridX) && Number.isFinite(token?.gridY);

/** Rounded centroid of the party's `players[]` tokens; grid centre when none. */
export function partyAnchor(mapDoc) {
    const tokens = (mapDoc?.players || []).filter(hasCoord);
    if (tokens.length > 0) {
        const avgX = tokens.reduce((sum, t) => sum + t.gridX, 0) / tokens.length;
        const avgY = tokens.reduce((sum, t) => sum + t.gridY, 0) / tokens.length;
        return { gridX: Math.round(avgX), gridY: Math.round(avgY) };
    }
    const centre = Math.floor((Number(mapDoc?.gridSize) || 1) / 2);
    return { gridX: centre, gridY: centre };
}

/** Every cell already carrying a `players[]` or `placedItems` token. */
export function occupiedCells(mapDoc) {
    const cells = new Set();
    for (const token of [...(mapDoc?.players || []), ...(mapDoc?.placedItems || [])]) {
        if (hasCoord(token)) cells.add(cellKey(token.gridX, token.gridY));
    }
    return cells;
}

/**
 * Deterministic free-cell scan: the preferred offset cell first, then Chebyshev
 * rings outward (dx asc, dy asc within each ring), each candidate clamped into
 * [0, gridSize-1] before the occupancy test. Returns null only when the whole
 * clamped neighbourhood is occupied.
 */
export function findFreeSpawnCell({ anchor, occupied, gridSize,
    preferred = SPAWN_TOKEN_PREFERRED_OFFSET, radius = SPAWN_TOKEN_SCAN_RADIUS } = {}) {
    const edge = Math.max(1, Number(gridSize) || 1) - 1;
    const clamp = (value) => Math.min(edge, Math.max(0, value));
    const targetX = clamp(anchor.gridX + preferred.dx);
    const targetY = clamp(anchor.gridY + preferred.dy);
    for (let ring = 0; ring <= radius; ring++) {
        for (let dx = -ring; dx <= ring; dx++) {
            for (let dy = -ring; dy <= ring; dy++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                const x = clamp(targetX + dx);
                const y = clamp(targetY + dy);
                if (occupied.has(cellKey(x, y))) continue;
                return { gridX: x, gridY: y };
            }
        }
    }
    return null;
}

/** Position-embedded id (staging `coverId` precedent): unique per cell for free. */
export function spawnTokenId(name, cell) {
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `quick-spawn-${slug}-${cell.gridX}-${cell.gridY}`;
}

/**
 * One `{id,type:'npc',name,gridX,gridY,visible:true}` row per spawned board
 * name, party-relative and never stacked (earlier draws stay blocked for later
 * ones). Stops at the first name with no free cell — the caller names the
 * shortfall loudly rather than silently placing a partial batch elsewhere.
 */
export function buildSpawnTokenRows(mapDoc, names) {
    const anchor = partyAnchor(mapDoc);
    const occupied = occupiedCells(mapDoc);
    const gridSize = mapDoc?.gridSize;
    const rows = [];
    for (const name of names || []) {
        const cell = findFreeSpawnCell({ anchor, occupied, gridSize });
        if (!cell) break;
        occupied.add(cellKey(cell.gridX, cell.gridY));
        rows.push({ id: spawnTokenId(name, cell), type: 'npc', name, gridX: cell.gridX, gridY: cell.gridY, visible: true });
    }
    return rows;
}

/**
 * Series-renumber follow (owner law 2026-11-09): when a second Goblin joins,
 * the join lane renames the plain board row 'Goblin' → 'Goblin 1' BEFORE the
 * new instance draws 'Goblin 2'. Range/cover measurement matches a token by its
 * EXACT board name, so the orphaned plain-name token must follow the board —
 * rename it to the lowest numbered row in the series that the board holds and
 * no token claims yet. Returns whether a rename happened (a rename alone still
 * justifies the map write).
 */
export function renumberSeriesToken(placedItems, boardNames, baseName) {
    const board = new Set(boardNames);
    if (board.has(baseName)) return false;
    const token = placedItems.find(t => (t.type === 'npc' || t.type === 'monster') && t.name === baseName);
    if (!token) return false;
    const claimed = new Set(placedItems.map(t => t.name));
    let next = 1;
    while (claimed.has(`${baseName} ${next}`) && board.has(`${baseName} ${next}`)) next += 1;
    const candidate = `${baseName} ${next}`;
    if (!board.has(candidate)) return false;
    token.name = candidate;
    return true;
}
