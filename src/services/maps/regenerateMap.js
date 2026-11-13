// Regenerate-from-stamped-opts (VG backlog 2026-11-12): turns the `generationOpts`
// stamp (generator-opts-persistence improve) into a player-facing feature. The stamp
// carries every knob the create modal actually consumed, so the doc alone re-derives
// its own map: run the same CLIENT generator with the STAMPED opts verbatim and PUT
// the result back onto the same document. Docs without the stamp (owner fixtures,
// hand-authored maps) never reach this lane — the row face stays disabled.
import { generateDungeon, generateAdjacentDungeon } from './dungeonGenerator.js';
import { generateHexTerrain } from './hexTerrainGenerator.js';
import * as mapsService from './mapsService.js';
import { addEntry } from '../ui/logService.js';

// One generator per stamped mode — the exact trio Generate{Dungeon,Terrain}Modal call.
// The stamped object is passed VERBATIM: each generator reads only the keys it knows
// and ignores the display-only stamp extras (mode, roomSize).
const GENERATORS = {
    adjacent: generateAdjacentDungeon,
    bsp: generateDungeon,
    terrain: generateHexTerrain,
};

// Layout fields each generator produces and a regenerate therefore REPLACES. Everything
// else in the document is identity (name, displayName, createdAt, description, players,
// generationOpts, seed — the slug stays because the PUT targets the same segment) or
// user/view state (zoom/pan/partyPosition/pois/revealed/…) and is never touched here.
// Note the dungeon twins RETURN `name`/`description`/`players:[]` too — deliberately
// absent from this list so a regenerated map keeps its authored label, blurb and tokens.
const LAYOUT_FIELDS_BY_MODE = {
    adjacent: ['gridSize', 'walls', 'placedItems', 'generationMode'],
    bsp: ['gridSize', 'walls', 'placedItems'],
    terrain: ['terrain', 'rivers'],
};

const MODE_LABELS = {
    adjacent: 'Room Adjacent',
    bsp: 'BSP Dungeon',
    terrain: 'Terrain',
};

const titleCase = (value) => String(value).charAt(0).toUpperCase() + String(value).slice(1);

// Read-only "Generated with: …" tooltip copy (criterion: mode, seed, gridSize plus the
// mode-specific keys of the stamp). Returns null for an absent stamp so the caller can
// show the honest legacy face instead of an empty tooltip.
export function describeGenerationOpts(generationOpts) {
    if (!generationOpts || !generationOpts.mode) return null;
    const opts = generationOpts;
    const parts = [
        `Mode: ${MODE_LABELS[opts.mode] || opts.mode}`,
        `Seed: ${opts.seed}`,
        `Grid size: ${opts.gridSize}`,
    ];
    if (opts.density !== undefined) parts.push(`Density: ${Math.round(opts.density * 100)}%`);
    if (opts.roomSize) parts.push(`Room size: ${titleCase(opts.roomSize)}`);
    if (opts.roomCount !== undefined) parts.push(`Rooms: ${opts.roomCount}`);
    if (opts.minRoom !== undefined) parts.push(`Room bounds: ${opts.minRoom}-${opts.maxRoom}`);
    if (opts.corridorLength) parts.push(`Corridors: ${titleCase(opts.corridorLength)}`);
    if (opts.layoutStyle) parts.push(`Layout: ${titleCase(opts.layoutStyle)}`);
    return `Generated with: ${parts.join(' · ')}`;
}

// Pure merge: fresh generator output over the CURRENT document, replacing only the
// stamped mode's layout fields. Throws on an unknown mode — a corrupt stamp must fail
// loudly rather than PUT a half-derived document.
export function buildRegeneratedDocument(doc, generationOpts) {
    const generator = GENERATORS[generationOpts?.mode];
    if (!generator) {
        throw new Error(`Cannot regenerate: unknown generation mode "${generationOpts?.mode}"`);
    }
    const generated = generator(generationOpts);
    const next = { ...doc };
    for (const field of LAYOUT_FIELDS_BY_MODE[generationOpts.mode]) {
        if (generated[field] !== undefined) next[field] = generated[field];
    }
    return next;
}

// Full lane: GET the doc → re-derive with its stamped opts → PUT back to the SAME doc
// (existing saveMapData whole-document lane) → exactly ONE campaign-log audit row naming
// the map (the ai_dress row precedent beside it; unregistered types render through the
// log's GenericEntry fallback via `description`). Any throw before the PUT writes
// nothing; a failed PUT logs nothing.
export async function regenerateMapDocument(campaignName, fileName, generationOpts) {
    const doc = await mapsService.loadMapData(campaignName, fileName);
    const updated = buildRegeneratedDocument(doc, generationOpts);
    await mapsService.saveMapData(campaignName, fileName, updated);
    const label = doc.displayName || doc.name || fileName.replace(/\.json$/, '');
    await addEntry(campaignName, {
        type: 'map_regenerated',
        description: `Map regenerated from recorded options: "${label}" (${MODE_LABELS[generationOpts.mode] || generationOpts.mode}, seed ${generationOpts.seed})`,
        map: label,
        mode: generationOpts.mode,
        seed: generationOpts.seed,
    });
    return updated;
}
