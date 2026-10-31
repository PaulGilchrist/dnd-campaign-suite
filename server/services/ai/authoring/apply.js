/**
 * AI Campaign Authoring (plan Phase 2) — applyBlueprint: the ONLY write path
 * for AI-authored campaign content. Never touches HTTP, never raw-writes the
 * campaign folder from outside the lane semantics:
 *
 *  1. SHAPE: every row against its entity schema (./entitySchemas.js).
 *  2. REFERENCES: inward (batch) + outward (live campaign / bestiary) via
 *     ./referential.js — fabrications and shadow-name collisions reject the
 *     WHOLE blueprint before a single byte is written (fail closed, plan §1).
 *  3. RESTORE POINT: a pre-apply snapshot (utils/campaignSnapshots.js, shared
 *     with the admin lane) so a narratively-bad generation is one rollback
 *     away in the existing admin UI.
 *  4. WRITE: rows land as `draft: true` (owner ruling — invisible to players,
 *     badged for GM review). Id-bearing kinds (quests/factions) get
 *     server-assigned uuids exactly like their CRUD lanes; name-keyed kinds
 *     (npcs/settlements/sessions) and builder-preset encounters are appended.
 *     All file I/O goes through the hoisted jsonEntityCrud helpers so the
 *     stamp format, init-to-[] and pretty-print conventions cannot drift.
 *  5. BROADCAST + LOG: same `*-list-<campaign>`/`maps-list-<campaign>` SSE
 *     channels the route lanes publish (clients re-fetch on any action
 *     payload), and one `ai_authoring` campaign-log entry (automation-logging).
 *  6. MAPS: mapPlans run the real generators IN-PROCESS and apply a
 *     deterministic dressing plan (./applyMaps.js) — the model never emits
 *     raw grid JSON. Written as draft maps, all-or-nothing per set.
 */
import { randomUUID } from 'crypto';
import { loadEntityList, saveEntityList, stampForSave } from '../../../utils/jsonEntityCrud.js';
import { readEncounters, writeEncounters } from '../../../utils/encounterUtils.js';
import { publish } from '../../../utils/changeData.js';
import { createSnapshot } from '../../../utils/campaignSnapshots.js';
import { addEntry } from '../../../routes/log.js';
import { validateBlueprintShape, validateEntity } from './entitySchemas.js';
import { buildCampaignContext, validateBlueprintReferences } from './referential.js';
import { applyMapPlans } from './applyMaps.js';

/** Keyed by the blueprint list field; mirrors each lane's create contract. */
const LIST_LANES = {
    factions: { entity: 'factions', singular: 'faction', withId: true },
    settlements: { entity: 'settlements', singular: 'settlement', withId: false },
    npcs: { entity: 'npcs', singular: 'npc', withId: false },
    quests: { entity: 'quests', singular: 'quest', withId: true },
    sessions: { entity: 'sessions', singular: 'session', withId: false },
};

export function collectBlueprintErrors(campaign, blueprint, context = null) {
    const shape = validateBlueprintShape(blueprint);
    const errors = [...shape.errors];
    if (shape.ok) {
        for (const [key, lane] of Object.entries(LIST_LANES)) {
            (blueprint[key] || []).forEach((row, i) => {
                const res = validateEntity(lane.singular, row);
                res.errors.forEach(e => errors.push(`${key}[${i}] "${row?.name}": ${e}`));
            });
        }
        (blueprint.encounters || []).forEach((row, i) => {
            validateEntity('encounter', row).errors.forEach(e => errors.push(`encounters[${i}] "${row?.name}": ${e}`));
        });
        (blueprint.mapPlans || []).forEach((row, i) => {
            validateEntity('mapPlan', row).errors.forEach(e => errors.push(`mapPlans[${i}] "${row?.name}": ${e}`));
        });
        const refs = validateBlueprintReferences(blueprint, context || buildCampaignContext(campaign));
        errors.push(...refs.errors);
    }
    return errors;
}

/**
 * Validate-then-apply a blueprint as drafts.
 * @param campaign target campaign (locked-campaign enforcement lives upstream
 *   in the route layer, mirroring every other GM lane)
 * @param blueprint designer output (shape per blueprintSchema)
 * @param {{ snapshot?: boolean, context?: object, log?: Function }} opts
 *   context: prebuilt campaign context (the designer already assembled one);
 *   log: injectable addEntry for tests.
 * @returns {Promise<{ ok, errors, created, snapshot }>}
 */
export async function applyBlueprint(campaign, blueprint, opts = {}) {
    const { snapshot = true, context = null, log = addEntry } = opts;
    const errors = collectBlueprintErrors(campaign, blueprint, context);
    if (errors.length) {
        return { ok: false, errors, created: {}, snapshot: null };
    }

    const snap = snapshot ? await createSnapshot(campaign) : null;
    try {
        const created = writeDrafts(campaign, blueprint);
        logSuccess(campaign, blueprint, created, snap, log);
        return { ok: true, errors: [], created, snapshot: snap?.filename || null };
    } catch (error) {
        // Partial application is recoverable: the pre-apply snapshot exists.
        console.error('[ai-authoring:apply]', error);
        return failMidBatch(campaign, error, snap, log);
    }
}

/** Append every kind as drafts; throws mid-way leave earlier kinds written
 *  (recoverable via the snapshot) — order is the plan's dependency spine. */
function writeDrafts(campaign, blueprint) {
    const created = {};
    for (const [key, lane] of Object.entries(LIST_LANES)) {
        created[key] = appendDraftList(campaign, key, lane, blueprint[key] || []);
    }
    created.encounters = appendDraftEncounters(campaign, blueprint.encounters || []);
    // Maps: in-process generators + deterministic dressing (Phase 5). Throws
    // on any bounds/itemIndex error BEFORE writing (all-or-nothing per set).
    created.maps = applyMapPlans(campaign, blueprint.mapPlans || []);
    return created;
}

function logSuccess(campaign, blueprint, created, snap, log) {
    const total = Object.values(created).reduce((sum, n) => sum + n, 0);
    const maps = created.maps || 0;
    log(campaign, {
        type: 'ai_authoring',
        name: 'AI designer',
        scope: blueprint.scope?.scope || 'bespoke',
        created,
        snapshot: snap?.filename || null,
        summary: `AI drafted ${total} entit${total === 1 ? 'y' : 'ies'}${maps ? ` (incl. ${maps} map${maps === 1 ? '' : 's'})` : ''}`,
    });
}

function failMidBatch(campaign, error, snap, log) {
    const message = String(error.message || error).slice(0, 300);
    log(campaign, {
        type: 'ai_authoring',
        name: 'AI designer',
        error: message,
        snapshot: snap?.filename || null,
    });
    return {
        ok: false,
        errors: [`apply failed mid-batch: ${message} — restore point: ${snap?.filename || 'none'}`],
        created: {},
        snapshot: snap?.filename || null,
    };
}

/** Append name-keyed / uuid rows as drafts, broadcast the lane's list channel. */
function appendDraftList(campaign, key, { entity, withId }, rows) {
    if (!rows.length) return 0;
    const disk = loadEntityList(campaign, entity);
    for (const row of rows) {
        const authored = withId ? { id: randomUUID(), ...row } : { ...row };
        const stamped = stampForSave(authored, null);
        disk.push({ ...stamped, draft: true }); // draft is force-stamped — never model-deniable
    }
    saveEntityList(campaign, entity, disk);
    for (const row of rows) {
        publish(`${entity}-list-${campaign}`, { action: 'created', name: row.name }, campaign);
    }
    return rows.length;
}

/** Builder-preset encounters (encounters.js create lane shape, as drafts). */
function appendDraftEncounters(campaign, rows) {
    if (!rows.length) return 0;
    const data = readEncounters(campaign);
    for (const row of rows) {
        data.encounters.push({
            name: row.name,
            savedAt: new Date().toISOString(),
            description: row.description || '',
            selectedMonsters: (row.selectedMonsters || []).map(m => ({
                index: m.index,
                name: m.name,
                qty: m.qty,
            })),
            draft: true,
        });
        publish(`encounters-list-${campaign}`, { action: 'created', encounter: { name: row.name } }, campaign);
    }
    writeEncounters(campaign, data);
    return rows.length;
}
