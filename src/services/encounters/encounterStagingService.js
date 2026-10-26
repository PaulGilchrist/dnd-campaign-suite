/**
 * Backlog 2026-10-26 run E — ONE reusable staging map per campaign for
 * accepted travel events (owner design decision).
 *
 * The event-accept lane used to spawn a fresh indoor arena per accepted
 * combat event ("<Parent> - <Event> at (q,r)"), so GM campaigns accreted
 * orphan encounter maps. Instead of per-event arenas, accepted events now
 * (re)target a single stable document resolved by slug
 * (`travel-encounter-stage.json`):
 *
 *  - first accept  → create the staging map (POST + full-doc PUT, exactly
 *                    the lane the per-event arena used) and place combatants;
 *  - every later accept → one full-doc PUT that WIPES the previous placed
 *                    items and seeds a FRESH randomized cover layout, so
 *                    each fight gets different 1/2, 3/4 and full-cover
 *                    options around the combatant spawn zone.
 *
 * Cover tiers are what `rules/combat/coverService.js` `computeCover`
 * actually reads off `placedItems` (decorative tree/boulder/bush types are
 * NOT cover in this engine):
 *  - HALF (+2 AC): single-cell barrel/chair/chest/crate/fountain/pillar/statue;
 *  - THREE_QUARTER (+5 AC): two-cell altar/bed/bookshelf/table (the second
 *    cell follows `rotation` — 90 ⇒ above, else right);
 *  - FULL: a CLOSED DOOR item (`type:'door', open:false`) interposed on the
 *    ray — the same FULL tier a wall cell grants, but an item, so the whole
 *    staging layout lives in `placedItems` and every reuse is a pure
 *    wipe-and-reseed of one field.
 *
 * Randomization is client-side `Math.random` seeded at accept time and
 * written through the existing server-first map lanes (mapsService POST/PUT
 * — no localStorage, no timers, AGENTS.md compliant). Combatant spawn cells
 * (party tokens + monster placements + biome decor) are reserved so no cover
 * ever lands under a token.
 */
import * as mapsService from '../maps/mapsService.js';

export const STAGING_MAP_NAME = 'Travel Encounter Stage';
export const STAGING_MAP_SLUG = mapsService.toKebabCase(STAGING_MAP_NAME);
const STAGING_FILE_NAME = `${STAGING_MAP_SLUG}.json`;

// Mirrors the sets in rules/combat/coverService.js (buildCoverMap).
export const HALF_COVER_ITEM_TYPES = ['barrel', 'chair', 'chest', 'crate', 'fountain', 'pillar', 'statue'];
export const THREE_QUARTER_COVER_ITEM_TYPES = ['altar', 'bed', 'bookshelf', 'table'];

const MIN_SPAWN_DIST = 2;  // keep the immediate party cluster open for melee
const MAX_SPAWN_DIST = 13; // enemy ring is 6-12 from centre — cover out to 13 flanks it

function shuffleInPlace(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function coverId(type, gx, gy) {
    // Position-embedded id: a reseeded layout has different ids for free,
    // which makes the wipe-and-reseed diff readable on the map document.
    return `stage-cover-${type}-${gx}-${gy}`;
}

/**
 * Pure randomized cover layout around the combatant spawn zone.
 * @param gridSize indoor grid edge (arena lane uses 30)
 * @param blockedCells "gx,gy" cells reserved for tokens/decor — never covered
 * @param rng injectable random source (tests pass a deterministic stub)
 * @returns {Array} placedItems for all three cover tiers
 */
export function generateCoverLayout({ gridSize = 30, blockedCells = [], rng = Math.random } = {}) {
    const ctx = makeLayoutContext(gridSize, blockedCells, rng);
    placeHalfCover(ctx);
    placeThreeQuarterCover(ctx);
    placeFullCover(ctx);
    return ctx.items;
}

// Candidate ring around the grid centre (spawn zone), pre-shuffled; tiers
// consume cells sequentially so no two items ever share a cell.
function makeLayoutContext(gridSize, blockedCells, rng) {
    const center = Math.floor(gridSize / 2);
    const taken = new Set(blockedCells.filter((c) => typeof c === 'string'));
    const candidates = [];
    for (let x = 1; x < gridSize - 1; x++) {
        for (let y = 1; y < gridSize - 1; y++) {
            const key = `${x},${y}`;
            if (taken.has(key)) continue;
            const dist = Math.hypot(x - center, y - center);
            if (dist < MIN_SPAWN_DIST || dist > MAX_SPAWN_DIST) continue;
            candidates.push(key);
        }
    }
    shuffleInPlace(candidates, rng);
    return { gridSize, taken, candidates, cursor: 0, items: [], rng };
}

function takeCell(ctx) {
    while (ctx.cursor < ctx.candidates.length) {
        const key = ctx.candidates[ctx.cursor++];
        if (!ctx.taken.has(key)) return key.split(',').map(Number);
    }
    return null;
}

function pickType(rng, types) {
    return types[Math.floor(rng() * types.length)];
}

// 1/2 cover (+2 AC) — single-cell blockers, the most plentiful tier.
function placeHalfCover(ctx) {
    const { rng } = ctx;
    const count = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
        const cell = takeCell(ctx);
        if (!cell) return;
        const [gx, gy] = cell;
        const type = pickType(rng, HALF_COVER_ITEM_TYPES);
        ctx.items.push({ id: coverId(type, gx, gy), type, gridX: gx, gridY: gy, visible: true });
        ctx.taken.add(`${gx},${gy}`);
    }
}

// 3/4 cover (+5 AC) — two-cell furniture; BOTH occupied cells must be free.
function placeThreeQuarterCover(ctx) {
    const { rng, gridSize, taken } = ctx;
    const count = 2 + Math.floor(rng() * 3);
    let placed = 0;
    while (placed < count) {
        const cell = takeCell(ctx);
        if (!cell) return;
        const [gx, gy] = cell;
        const type = pickType(rng, THREE_QUARTER_COVER_ITEM_TYPES);
        // getOccupiedCells in coverService: rotation%180===90 ⇒ cell above,
        // else the cell to the right. Try the rolled orientation, then the
        // fallback; skip the anchor if neither second cell is available.
        const orientations = rng() < 0.5 ? [90, 0] : [0, 90];
        const rotation = orientations.find((rot) => {
            const nx = rot === 90 ? gx : gx + 1;
            const ny = rot === 90 ? gy + 1 : gy;
            return nx < gridSize && ny < gridSize && !taken.has(`${nx},${ny}`);
        });
        if (rotation === undefined) continue;
        taken.add(`${gx},${gy}`);
        if (rotation === 90) taken.add(`${gx},${gy + 1}`); else taken.add(`${gx + 1},${gy}`);
        ctx.items.push({ id: coverId(type, gx, gy), type, gridX: gx, gridY: gy, visible: true, rotation });
        placed++;
    }
}

// Full cover — closed doors (computeCover's item-side FULL producer; a GM
// can Open Door from the click-dock mid-fight to drop the cover).
function placeFullCover(ctx) {
    const { rng } = ctx;
    const count = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
        const cell = takeCell(ctx);
        if (!cell) return;
        const [gx, gy] = cell;
        ctx.items.push({
            id: coverId('door', gx, gy), type: 'door', gridX: gx, gridY: gy,
            visible: true, rotation: 0, open: false,
        });
        ctx.taken.add(`${gx},${gy}`);
    }
}

/**
 * Resolve-then-create-or-reseed the campaign's single staging map.
 * Server-first: POST (first time, broadcasts the maps-list row) followed by
 * the authoritative full-document PUT on BOTH legs — the PUT persists its
 * body verbatim (server preserveAuthoredNames keeps the label), so reuse is
 * literally "wipe items + reseed + re-place combatants" in one write.
 * @returns {Promise<{label: string, reused: boolean}>}
 */
export async function stageEventEncounterMap({
    campaignName,
    terrainType = 'plains',
    q = 0,
    r = 0,
    gridSize = 30,
    decorItems = [],
    monsterItems = [],
    players = [],
    bgFill = null,
    rng = Math.random,
} = {}) {
    const blockedCells = [...decorItems, ...monsterItems, ...players]
        .filter((i) => Number.isFinite(i?.gridX) && Number.isFinite(i?.gridY))
        .map((i) => `${i.gridX},${i.gridY}`);
    const coverItems = generateCoverLayout({ gridSize, blockedCells, rng });
    // Reuse wipes the previous layout BY CONSTRUCTION: the PUT body below is
    // rebuilt from scratch (fresh decor/cover/monsters), so no prior
    // placedItem survives the write.
    const placedItems = [...decorItems, ...coverItems, ...monsterItems];
    const mapDocument = {
        type: 'indoor',
        gridSize,
        walls: [],
        placedItems,
        players,
        fog: [],
        parentTerrain: terrainType,
        parentHex: { q, r },
        bgFill,
        displayName: STAGING_MAP_NAME,
        name: STAGING_MAP_SLUG,
    };

    const { maps = [] } = await mapsService.loadMaps(campaignName);
    const reused = maps.some((m) => m.fileName === STAGING_FILE_NAME);
    if (!reused) {
        await mapsService.createMap(campaignName, STAGING_MAP_NAME, {
            type: 'indoor',
            gridSize,
            placedItems,
            players,
            fog: [],
            walls: [],
            parentTerrain: terrainType,
            parentHex: { q, r },
            bgFill,
        });
    }
    await mapsService.saveMapData(campaignName, STAGING_MAP_NAME, mapDocument);
    return { label: STAGING_MAP_NAME, reused };
}
