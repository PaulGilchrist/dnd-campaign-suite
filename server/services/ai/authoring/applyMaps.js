/**
 * AI Campaign Authoring (plan Phase 5) — the map pipeline.
 *
 * The model NEVER emits raw grid JSON (corruption risk, token explosion).
 * It emits a generator choice + params + a schema-constrained DRESSING PLAN
 * (./entitySchemas.js mapPlanSchema); this module runs the real generators
 * IN-PROCESS (the same modules the root CLI shims wrap) and executes the
 * dressing deterministically against the produced document. The model still
 * makes every creative decision — the code only does the typing.
 *
 * Bounds truth per generator kind (learned from the generators themselves,
 * not assumed): hex grids are NOT square — gridSize N spans q 0..2N-1 /
 * r 0..N-1 — so hex placement validity is checked against the ACTUAL terrain
 * cells produced, and dungeon placement against the square grid.
 *
 * Written as DRAFT maps mirroring POST /maps create semantics (file write +
 * `maps-list-<campaign>` 'created' broadcast with {name,fileName,slug}).
 * Draft maps are player-invisible and unactivatable (Phase 3 seams), so a
 * bad generation is approve-gated by default. Any dressing error aborts the
 * WHOLE set before a single file lands (fail closed).
 */
import fs from 'fs';
import path from 'path';
import { campaignMapsDir, ensureDataDir } from '../../../utils/campaignPaths.js';
import { publish } from '../../../utils/changeData.js';
import { generateDungeon } from '../../../../src/services/maps/dungeonGenerator.js';
import { generateHexTerrain } from '../../../../src/services/maps/hexTerrainGenerator.js';

const aiId = (prefix, ...parts) => `ai-${prefix}-${parts.join('-')}`;

/** Build the document and its placement checker per generator kind. */
function generateDocument(plan) {
    if (plan.generator === 'hex') {
        const generated = generateHexTerrain({
            gridSize: plan.params?.gridSize ?? 20,
            seed: plan.params?.seed,
            weights: plan.params?.weights ?? null,
        });
        const cells = new Set(Object.keys(generated.terrain));
        return {
            within: (x, y) => Number.isInteger(x) && Number.isInteger(y) && cells.has(`${x},${y}`),
            extent: `${cells.size} hex cells`,
            doc: {
                displayName: plan.displayName,
                name: plan.name,
                type: 'outdoor',
                gridSize: plan.params?.gridSize ?? 20,
                terrain: generated.terrain,
                rivers: generated.rivers,
                pois: [],
                zoom: 1,
                panX: 0,
                panY: 0,
            },
        };
    }
    const generated = generateDungeon({
        gridSize: plan.params?.gridSize ?? 30,
        density: plan.params?.density ?? 0.5,
        seed: plan.params?.seed,
    });
    const n = generated.gridSize;
    return {
        within: (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < n && y < n,
        extent: `${n}×${n} grid`,
        doc: {
            displayName: plan.displayName,
            name: plan.name,
            type: 'indoor',
            gridSize: n,
            walls: generated.walls,
            placedItems: generated.placedItems,
            paintCells: [],
            items: [],
            players: [],
            fog: [],
            generationMode: 'ai-designed',
            description: generated.description,
            seed: generated.seed,
            terrain: {},
            pois: [],
            zoom: 2,
            panX: 0,
            panY: 0,
        },
    };
}

/** POIs: hex docs speak q/r + label + linkedMap; indoor docs gridX/gridY. */
function dressPois(doc, within, extent, pois, errors) {
    const outdoor = doc.type === 'outdoor';
    (pois || []).forEach((poi, i) => {
        if (!within(poi.gridX, poi.gridY)) {
            errors.push(`${doc.name}: pois[${i}] "${poi.name}" at (${poi.gridX},${poi.gridY}) is outside the map (${extent})`);
            return;
        }
        doc.pois.push({
            id: aiId('poi', doc.name, i),
            type: 'landmark',
            ...(outdoor ? { q: poi.gridX, r: poi.gridY } : { gridX: poi.gridX, gridY: poi.gridY }),
            label: poi.name,
            description: poi.description || '',
            visible: true,
            ...(poi.targetMap ? { linkedMap: poi.targetMap } : {}),
        });
    });
}

function dressPlacedItems(doc, within, extent, ops, errors) {
    (ops || []).forEach((op, i) => {
        const at = `${doc.name}: placedItemOps[${i}] (${op.op})`;
        if (op.op === 'add') {
            const item = op.item || {};
            if (!within(item.gridX, item.gridY)) {
                errors.push(`${at} item at (${item.gridX},${item.gridY}) is outside the map (${extent})`);
                return;
            }
            doc.placedItems.push({
                id: aiId(item.type || 'item', item.gridX, item.gridY),
                type: item.type || 'chest',
                gridX: item.gridX,
                gridY: item.gridY,
                visible: true,
                rotation: 0,
            });
            return;
        }
        const target = doc.placedItems[op.itemIndex];
        if (!target) {
            errors.push(`${at} itemIndex ${op.itemIndex} does not address a generated item (${doc.placedItems.length} exist)`);
            return;
        }
        if (op.op === 'remove') doc.placedItems.splice(op.itemIndex, 1);
        else if (op.op === 'move') {
            if (!within(op.gridX, op.gridY)) {
                errors.push(`${at} destination (${op.gridX},${op.gridY}) is outside the map (${extent})`);
                return;
            }
            target.gridX = op.gridX;
            target.gridY = op.gridY;
        }
    });
}

/** Encounter monsters as map tokens — the items[] lane ({id,name,type,grid}). */
function dressTokens(doc, within, extent, tokens, errors) {
    (tokens || []).forEach((tok, i) => {
        if (!within(tok.gridX, tok.gridY)) {
            errors.push(`${doc.name}: tokens[${i}] "${tok.creatureName}" at (${tok.gridX},${tok.gridY}) is outside the map (${extent})`);
            return;
        }
        doc.items.push({
            id: aiId('token', doc.name, i),
            name: tok.creatureName,
            type: 'monster',
            gridX: tok.gridX,
            gridY: tok.gridY,
            fromEncounter: tok.encounterName,
            visible: true,
        });
    });
}

/**
 * Generate + dress + persist every map plan as drafts. All plans are dressed
 * and checked FIRST; any error aborts the whole set before a single file is
 * written (all-or-nothing, like the entity gate).
 * @returns {number} maps written
 */
export function applyMapPlans(campaign, mapPlans) {
    if (!mapPlans.length) return 0;
    const errors = [];
    const docs = mapPlans.map((plan) => {
        const { doc, within, extent } = generateDocument(plan);
        const d = plan.dressing || {};
        dressPois(doc, within, extent, d.pois, errors);
        if (doc.type === 'indoor') dressPlacedItems(doc, within, extent, d.placedItemOps, errors);
        else if (d.placedItemOps?.length) errors.push(`${plan.name}: placedItemOps are dungeon-only (hex maps carry terrain + POIs)`);
        dressTokens(doc, within, extent, d.tokens, errors);
        return doc;
    });
    if (errors.length) throw new Error(errors.join(' — '));

    ensureDataDir(campaign);
    const mapsDir = campaignMapsDir(campaign);
    if (!fs.existsSync(mapsDir)) fs.mkdirSync(mapsDir, { recursive: true });

    docs.forEach((doc) => {
        const fileName = `${doc.name}.json`;
        fs.writeFileSync(path.join(mapsDir, fileName), JSON.stringify({ ...doc, draft: true }, null, 2));
        publish(`maps-list-${campaign}`, {
            action: 'created',
            map: { name: doc.displayName, fileName, slug: doc.name },
        }, campaign);
    });
    return docs.length;
}
