/**
 * AI Campaign Authoring (residual item 2) — "AI Dress": refine for LIVE maps
 * with IN-PLACE ops. Design is owner-locked: never regenerate a map — the
 * model dresses the real document (add/move/remove placedItems, POIs/portals,
 * monster/NPC tokens) addressed by the entities' actual document ids, because
 * a live document has drifted from any generator output.
 *
 * The funnel mirrors refine.js exactly: preflight gates → prompt with a
 * COMPACT digest (never the walls/paint/fog/revealed/image blobs) →
 * jsonMode + constrained decoding off the SAME liveDressPlanSchema the
 * validator enforces → ≤2 repair retries → deterministic applier that
 * validates every op against the ACTUAL document — any invalid op rejects
 * the WHOLE plan before anything is returned (all-or-nothing).
 *
 * Principle 3: this module NEVER writes. The proposal (op list + human
 * preview + pre-validated merged document) returns to the GM; the normal
 * map PUT lane (mapsService.saveMapData) persists it, drafts keep their
 * draft flag, and walls/paint/fog/image layers are untouchable because the
 * op set has no verbs for them.
 */
import fs from 'fs';
import path from 'path';
import { campaignMapsDir, normalizeMapFile } from '../../../utils/campaignPaths.js';
// Single kebab implementation (pinned client/server parity) — no third copy.
import { toKebabCase } from '../../../routes/maps.js';
import { chat } from '../providers/localProvider.js';
import { aiConfigLive } from '../index.js';
import { extractJsonObject } from '../promptBuilder.js';
import { readJson } from './referential.js';
import { liveDressPlanSchema, validateLiveDressPlan } from './entitySchemas.js';

const json = (v) => JSON.stringify(v);

// -- live document read (GM-only route in front of this; drafts readable) ----

/** Exact fileName/slug first, display name kebab fallback (mirrors maps.js GET). */
export function resolveLiveMapFile(mapsDir, mapname) {
    const raw = String(mapname || '');
    const exact = normalizeMapFile(raw);
    if (fs.existsSync(path.join(mapsDir, exact))) return exact;
    const kebab = normalizeMapFile(toKebabCase(raw));
    return fs.existsSync(path.join(mapsDir, kebab)) ? kebab : null;
}

// -- compact digest -----------------------------------------------------------

function compactRows(rows, mapFn, limit = 140) {
    const list = Array.isArray(rows) ? rows : [];
    return { rows: list.slice(0, limit).map(mapFn), omitted: Math.max(0, list.length - limit) };
}

/**
 * ids/types/cells + grid bounds + terrain-cell counts. Deliberately NEVER
 * walls/paintCells/fog/revealed/players/image bytes: the model cannot edit
 * them, and a full blob would blow the context for a local model.
 */
export function buildMapDigest(doc) {
    const outdoor = doc.type === 'outdoor';
    const at = (e) => (outdoor ? `${e.q},${e.r}` : `${e.gridX},${e.gridY}`);
    const digest = {
        name: doc.name,
        displayName: doc.displayName,
        type: doc.type,
        grid: outdoor ? `${Object.keys(doc.terrain || {}).length} hex cells addressed q,r` : `${doc.gridSize}×${doc.gridSize} square grid`,
    };
    if (outdoor) {
        const counts = {};
        for (const t of Object.values(doc.terrain || {})) counts[t] = (counts[t] || 0) + 1;
        digest.terrainCellCounts = counts;
    } else {
        digest.items = compactRows(doc.placedItems, it => ({ id: it.id, type: it.type, at: at(it) }));
        digest.tokens = compactRows(doc.items, t => ({ id: t.id, name: t.name, type: t.type, at: at(t) }));
    }
    digest.pois = compactRows(doc.pois, p => ({
        id: p.id, label: p.label, at: at(p), ...(p.linkedMap ? { linkedMap: p.linkedMap } : {}),
    }), 60);
    return digest;
}

// -- deterministic applier (validation is the gate; all-or-nothing) -----------

const INDOOR_ONLY = new Set(['item', 'token']);

function laneOf(doc, target) {
    if (target === 'item') return doc.placedItems;
    if (target === 'token') return doc.items;
    return doc.pois;
}

function placementChecker(doc) {
    if (doc.type === 'outdoor') {
        const cells = new Set(Object.keys(doc.terrain || {}));
        return {
            outdoor: true,
            within: (x, y) => Number.isInteger(x) && Number.isInteger(y) && cells.has(`${x},${y}`),
            extent: `${cells.size} hex cells`,
        };
    }
    const n = doc.gridSize;
    return {
        outdoor: false,
        within: (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < n && y < n,
        extent: `${n}×${n} grid`,
    };
}

function freshId(rows, prefix) {
    let id = `${prefix}-${rows.length}`;
    for (let n = rows.length + 1; rows.some(r => r.id === id); n += 1) id = `${prefix}-${n}`;
    return id;
}

function addPlacedItem(rows, op, at, ctx) {
    if (!op.item?.type) { ctx.errors.push(`${at} needs item.type (chest, trap, torch, door…)`); return; }
    const row = {
        id: freshId(rows, `ai-dress-item-${op.item.type}-${op.gridX}-${op.gridY}`),
        type: op.item.type,
        gridX: op.gridX,
        gridY: op.gridY,
        visible: true,
        rotation: 0,
        ...(op.item.name ? { name: op.item.name } : {}),
    };
    rows.push(row);
    ctx.preview.push(`add ${row.type} at ${op.gridX},${op.gridY}`);
}

function addToken(rows, op, at, ctx) {
    if (!op.token?.name) { ctx.errors.push(`${at} needs token.name`); return; }
    const kind = op.token.kind || 'monster';
    rows.push({
        id: freshId(rows, `ai-dress-token-${op.gridX}-${op.gridY}`),
        name: op.token.name,
        type: kind,
        gridX: op.gridX,
        gridY: op.gridY,
        visible: true,
        ...(op.token.fromEncounter ? { fromEncounter: op.token.fromEncounter } : {}),
    });
    ctx.preview.push(`add ${kind} token ${op.token.name} at ${op.gridX},${op.gridY}`);
}

function addPoi(rows, op, at, ctx) {
    if (!op.poi?.name) { ctx.errors.push(`${at} needs poi.name`); return; }
    rows.push({
        id: freshId(rows, `ai-dress-poi-${op.gridX}-${op.gridY}`),
        type: 'landmark',
        label: op.poi.name,
        description: op.poi.description || '',
        visible: true,
        ...(op.poi.targetMap ? { linkedMap: op.poi.targetMap } : {}),
        ...(ctx.place.outdoor ? { q: op.gridX, r: op.gridY } : { gridX: op.gridX, gridY: op.gridY }),
    });
    ctx.preview.push(`add POI ${op.poi.name} at ${op.gridX},${op.gridY}`);
}

function addRow(op, rows, at, ctx) {
    if (!ctx.place.within(op.gridX, op.gridY)) {
        ctx.errors.push(`${at} lands at (${op.gridX},${op.gridY}) — outside the map (${ctx.place.extent})`);
        return;
    }
    if (op.target === 'item') addPlacedItem(rows, op, at, ctx);
    else if (op.target === 'token') addToken(rows, op, at, ctx);
    else addPoi(rows, op, at, ctx);
}

function moveRow(row, op, at, ctx) {
    if (!ctx.place.within(op.gridX, op.gridY)) {
        ctx.errors.push(`${at} destination (${op.gridX},${op.gridY}) is outside the map (${ctx.place.extent})`);
        return;
    }
    if (Number.isInteger(row.q)) { row.q = op.gridX; row.r = op.gridY; }
    else { row.gridX = op.gridX; row.gridY = op.gridY; }
    ctx.preview.push(`move ${row.name || row.label || row.id} → ${op.gridX},${op.gridY}`);
}

function applyOne(doc, op, i, ctx) {
    const at = `ops[${i}] "${op.op} ${op.target}"`;
    if (ctx.place.outdoor && INDOOR_ONLY.has(op.target)) {
        ctx.errors.push(`${at}: item/token ops are indoor-only (hex maps carry terrain + POIs)`);
        return;
    }
    const rows = laneOf(doc, op.target);
    if (op.op === 'add') { addRow(op, rows, at, ctx); return; }
    const idx = rows.findIndex(r => String(r?.id) === String(op.id));
    if (idx < 0) {
        ctx.errors.push(`${at}: id ${json(op.id)} is not in this map — move/remove must cite a real digest id`);
        return;
    }
    if (op.op === 'remove') {
        const [gone] = rows.splice(idx, 1);
        ctx.preview.push(`remove ${gone.id}`);
        return;
    }
    moveRow(rows[idx], op, at, ctx);
}

/**
 * Validate + execute every op against the ACTUAL document on a clone. Any
 * invalid op ⇒ { errors } and NOTHING is returned as updated (all-or-nothing
 * before the proposal ever reaches the GM).
 * @returns {{ errors: string[] } | { updated: object, preview: string[] }}
 */
export function applyDressOps(doc, ops) {
    const next = JSON.parse(JSON.stringify(doc)); // map documents are pure JSON
    next.placedItems = Array.isArray(next.placedItems) ? next.placedItems : [];
    next.items = Array.isArray(next.items) ? next.items : [];
    next.pois = Array.isArray(next.pois) ? next.pois : [];
    const ctx = { place: placementChecker(next), errors: [], preview: [] };
    (ops || []).forEach((op, i) => applyOne(next, op, i, ctx));
    return ctx.errors.length ? { errors: ctx.errors } : { updated: next, preview: ctx.preview };
}

// -- prompt + funnel -----------------------------------------------------------

function buildDressMessages({ digest, instruction }) {
    return [
        {
            role: 'system',
            content: `You dress ONE existing live D&D map for the Game Master with in-place operations. You never regenerate it and you never touch walls, painting, fog, revealed area, or images — your op set has NO verbs for them.
Output ONLY a single JSON object: {"ops":[…]}, nothing else. Each op:
{ "op": "add"|"move"|"remove", "target": "item"|"poi"|"token", "gridX": n, "gridY": n, … }
- item  = placed prop (chest, trap, torch, door, furniture…) — INDOOR maps only; add carries item{type,name?}
- poi   = labelled point of interest, optionally a portal via poi.targetMap (kebab file name of another map); add carries poi{name,description?,targetMap?}
- token = monster/NPC marker on the token lane — INDOOR maps only; add carries token{name,kind monster|npc,fromEncounter?}
- add needs gridX/gridY on open ground inside the grid (hex: a cell that exists in the terrain — check the counts and pick sensible central land).
- move needs the entity's EXACT id from the digest + the new gridX/gridY. remove needs that EXACT id. NEVER invent ids or addresses.
- On hex maps gridX=q and gridY=r. Small coherent sets beat sprawling ones; tie the dressing to the GM's instruction.
MAP DIGEST (the live document — ids and cells exactly as listed): ${json(digest)}`,
        },
        { role: 'user', content: `GM instruction: ${instruction}\nEmit the ops JSON now.` },
    ];
}

function audit(log, info) {
    if (typeof log !== 'function') return;
    log(info.campaign, { type: 'ai_dress', name: 'AI dress', map: info.map, instruction: String(info.instruction).slice(0, 200), ops: info.ops, attempts: info.attempts });
}

/** Everything refusible before a model call — refine.js's gate shape again. */
function dressPreflight({ campaign, mapName, instruction, aiConfig }) {
    if (!aiConfigLive(aiConfig)) return { code: 'AI_OFF' };
    const ask = String(instruction || '').trim().slice(0, 2000);
    if (!ask) return { code: 'NO_INSTRUCTION' };
    const mapsDir = campaignMapsDir(campaign);
    const fileName = resolveLiveMapFile(mapsDir, mapName);
    const doc = fileName ? readJson(path.join(mapsDir, fileName), null) : null;
    if (!doc || typeof doc !== 'object') return { code: 'MAP_NOT_FOUND' };
    return { ask, doc, fileName };
}

/**
 * @param {{ campaign, mapName, instruction, aiConfig, log?, chatFn? }} p
 * @returns {Promise<{ok:true, map, ops, preview, updated}|{ok:false, errors|code}>}
 *   `updated` is the pre-validated merged document (every other layer byte-
 *   identical to the live one, draft flag preserved) — the client PUTs it
 *   through the normal map save lane when the GM applies the preview.
 */
export async function dressMapProposal({ campaign, mapName, instruction, aiConfig, log, chatFn = chat }) {
    const ready = dressPreflight({ campaign, mapName, instruction, aiConfig });
    if (ready.code) return { ok: false, code: ready.code };
    const { ask, doc, fileName } = ready;
    const mapKey = fileName.replace(/\.json$/, '');

    const messages = buildDressMessages({ digest: buildMapDigest(doc), instruction: ask });
    let lastErrors = ['no attempt made'];
    let repairOf = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        const call = attempt === 1 ? messages : [
            ...messages,
            { role: 'assistant', content: String(json(repairOf)).slice(0, 20000) },
            { role: 'user', content: `Those ops failed validation against the live document:\n- ${lastErrors.join('\n- ')}\nFix every error; output ONLY the corrected {"ops":[…]} JSON.` },
        ];
        let content;
        try {
            content = await chatFn({
                endpoint: aiConfig.endpoint, model: aiConfig.model,
                temperature: aiConfig.temperature, provider: aiConfig.provider,
                timeoutMs: aiConfig.timeoutMs, messages: call, jsonMode: true,
                responseSchema: liveDressPlanSchema, schemaName: 'dress_plan',
                jsonSchema: aiConfig.jsonSchema,
            });
        } catch (e) {
            lastErrors = [`${e.code || 'ERROR'}: ${String(e.message || e).slice(0, 160)}`];
            continue;
        }
        const parsed = extractJsonObject(content);
        if (!parsed.ok) { lastErrors = ['model answer was not valid JSON']; continue; }
        const shape = validateLiveDressPlan(parsed.value);
        if (!shape.ok) { lastErrors = shape.errors; repairOf = parsed.value; continue; }
        const applied = applyDressOps(doc, parsed.value.ops);
        if (applied.errors) { lastErrors = applied.errors; repairOf = parsed.value; continue; }
        audit(log, { campaign, map: mapKey, instruction: ask, ops: parsed.value.ops.length, attempts: attempt });
        return { ok: true, map: mapKey, ops: parsed.value.ops, preview: applied.preview, updated: applied.updated };
    }
    audit(log, { campaign, map: mapKey, instruction: ask, ops: 0, attempts: 0 });
    return { ok: false, errors: lastErrors };
}
