/**
 * AI Campaign Authoring (plan Phase 1) — referential-integrity validation for
 * authored blueprints, the second face of "never repair, fail closed"
 * (./schemaValidator.js handles shape; this handles references).
 *
 * Two faces (owner requirement — extensions must hook into the live story):
 *  - INWARD:  batch-internal references (settlement notableNPCs, session
 *             links, map-plan POI targets / token encounter names) resolve
 *             against existing campaign rows ∪ same-batch rows; names are
 *             unique within the batch (findDuplicateNameError convention).
 *  - OUTWARD: references into EXISTING approved entities are valid tie-ins;
 *             name collisions with live rows (post-normalization,
 *             case-insensitive) are rejected as rename prompts rather than
 *             silently creating shadow rows (mirrors the duplicate-name 400s
 *             the CRUD lanes already enforce); and NPC names must not match
 *             a bestiary monster (mirrors the npc CRUD bestiary guard —
 *             pre-made monsters join via the Encounter Builder, they never
 *             live in npcs.json).
 *
 * Monster references (encounter.selectedMonsters[].index) resolve against the
 * real bestiary file — index must exist AND the paired name must match the
 * bestiary spelling, so the join card pulls the true stat block.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { campaignDir } from '../../../utils/campaignPaths.js';
import { findDuplicateNameError } from '../../../utils/nameUniqueness.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const BESTIARY_FILE = path.join(PROJECT_ROOT, 'public', 'data', 'monsters.json');

const lower = v => String(v == null ? '' : v).trim().toLowerCase();

export function readJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return fallback;
    }
}

/**
 * Snapshot everything a blueprint may reference. Reads the same on-disk
 * sources the CRUD lanes own (drafts are NOT special here — a live draft row
 * is a legal reference target for a newer batch; whether it was REJECTED is
 * unknowable post-delete, and the delete lanes 404 so stale refs simply fail
 * the "not found" leg). Pass `root` to point at a fixture directory in tests.
 */
export function buildCampaignContext(campaign, { root } = {}) {
    const base = root || campaignDir(campaign);
    const dataFile = name => path.join(base, 'data', name);
    const toSet = (rows, ...fields) => {
        const set = new Set();
        for (const row of Array.isArray(rows) ? rows : []) {
            for (const f of fields) if (row?.[f]) set.add(lower(row[f]));
        }
        return set;
    };
    const quests = readJson(dataFile('quests.json'), []);
    const npcs = readJson(dataFile('npcs.json'), []);
    const factions = readJson(dataFile('factions.json'), []);
    const settlements = readJson(dataFile('settlements.json'), []);
    const sessions = readJson(dataFile('sessions.json'), []);
    const notes = readJson(dataFile('notes.json'), []);
    const encountersWrap = readJson(dataFile('encounters.json'), { encounters: [] });
    const monsters = readJson(BESTIARY_FILE, []);

    let mapNames = new Set();
    try {
        mapNames = new Set(fs.readdirSync(path.join(base, 'maps'))
            .filter(f => f.endsWith('.json'))
            .map(f => lower(f.replace(/\.json$/, ''))));
    } catch { /* campaign without maps dir yet */ }

    return {
        quests: toSet(quests, 'name', 'id'),
        npcs: toSet(npcs, 'name', 'id'),
        factions: toSet(factions, 'name', 'id'),
        settlements: toSet(settlements, 'name', 'id'),
        sessions: toSet(sessions, 'name', 'id'),
        notes: toSet(notes, 'id', 'partyLocation'),
        encounters: toSet(encountersWrap.encounters, 'name'),
        maps: mapNames,
        // bestiary: index → display name, the join card's contract
        monsters: new Map((Array.isArray(monsters) ? monsters : [])
            .map(m => [lower(m.index), m.name])),
        monsterNames: new Set((Array.isArray(monsters) ? monsters : [])
            .map(m => lower(m.name))),
    };
}

const BATCH_KIND_TO_DISPLAY = {
    factions: 'faction', settlements: 'settlement', npcs: 'npc',
    quests: 'quest', sessions: 'session', encounters: 'encounter',
};

/** Add every batch row's name to its context set (inward resolution). */
function batchSets(blueprint) {
    const sets = {};
    for (const [key, display] of Object.entries(BATCH_KIND_TO_DISPLAY)) {
        const clash = findDuplicateNameError(blueprint[key], display);
        sets[key] = { clash, names: toSetFrom(blueprint[key]) };
    }
    sets.mapPlans = {
        clash: findDuplicateNameError(
            (blueprint.mapPlans || []).map(p => ({ name: p?.displayName })), 'map'
        ),
        names: new Set((blueprint.mapPlans || []).map(p => lower(p?.name))),
    };
    return sets;
}

function toSetFrom(rows) {
    const set = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
        if (row?.name) set.add(lower(row.name));
    }
    return set;
}

/**
 * Validate a (shape-checked) blueprint's references. Returns
 * { ok, errors, renameConflicts } — errors are plain-English, model-actionable
 * (fed back into the ≤2-attempt retry loop); renameConflicts lists rows the
 * GM should rename because a live campaign row already owns the name.
 * Each face of the contract is its own check function — one concept per row
 * of the dispatcher, matching the fail-closed validator convention.
 */
export function validateBlueprintReferences(blueprint, ctx) {
    const errors = [];
    const renameConflicts = [];
    const sets = batchSets(blueprint);

    checkBatchDuplicates(sets, errors);
    checkOutwardCollisions(blueprint, ctx, errors, renameConflicts);
    checkBestiaryGuard(blueprint, ctx, errors);
    checkMonsterPairs(blueprint, ctx, errors);
    const npcAware = new Set([...ctx.npcs, ...sets.npcs.names]);
    checkSettlementNpcs(blueprint, npcAware, errors);
    const linkSets = {
        maps: new Set([...ctx.maps]),
        encounters: new Set([...ctx.encounters, ...sets.encounters.names]),
        npcs: npcAware,
        quests: new Set([...ctx.quests, ...sets.quests.names]),
        settlements: new Set([...ctx.settlements, ...sets.settlements.names]),
        notes: ctx.notes,
    };
    checkSessionLinks(blueprint, linkSets, errors);
    checkMapPlans(blueprint, ctx, sets, linkSets.encounters, errors);

    return { ok: errors.length === 0, errors, renameConflicts };
}

function checkBatchDuplicates(sets, errors) {
    for (const [key, { clash }] of Object.entries(sets)) {
        if (clash) errors.push(`blueprint.${key}: ${clash}`);
    }
}

function checkOutwardCollisions(blueprint, ctx, errors, renameConflicts) {
    const EXISTING_FOR = {
        factions: ctx.factions, settlements: ctx.settlements, npcs: ctx.npcs,
        quests: ctx.quests, sessions: ctx.sessions, encounters: ctx.encounters,
    };
    for (const [key, existing] of Object.entries(EXISTING_FOR)) {
        for (const row of blueprint[key] || []) {
            if (row?.name && existing.has(lower(row.name))) {
                errors.push(`${key}: "${row.name}" collides with an existing ${BATCH_KIND_TO_DISPLAY[key]} (names must be unique) — pick a different name`);
                renameConflicts.push({ kind: key, name: row.name });
            }
        }
    }
    for (const plan of blueprint.mapPlans || []) {
        if (plan?.name && ctx.maps.has(lower(plan.name))) {
            errors.push(`mapPlans: map file "${plan.name}" already exists — pick a different map name`);
        }
    }
}

function checkBestiaryGuard(blueprint, ctx, errors) {
    for (const npc of blueprint.npcs || []) {
        if (npc?.name && ctx.monsterNames.has(lower(npc.name))) {
            errors.push(`npcs: "${npc.name}" is a bestiary monster — pre-made monsters join through the Encounter Builder (encounter.selectedMonsters), never as NPCs`);
        }
    }
}

function checkMonsterPairs(blueprint, ctx, errors) {
    (blueprint.encounters || []).forEach((enc, i) => {
        (enc?.selectedMonsters || []).forEach((m, j) => {
            const at = `encounters[${i}].selectedMonsters[${j}]`;
            const realName = ctx.monsters.get(lower(m?.index));
            if (!realName) {
                errors.push(`${at}.index "${m?.index}" is not a bestiary monster index`);
            } else if (lower(m?.name) !== lower(realName)) {
                errors.push(`${at}.name "${m?.name}" does not match bestiary index "${m.index}" (real name: "${realName}")`);
            }
        });
    });
}

function checkSettlementNpcs(blueprint, npcAware, errors) {
    (blueprint.settlements || []).forEach((s, i) => {
        (s?.notableNPCs || []).forEach(name => {
            if (!npcAware.has(lower(name))) {
                errors.push(`settlements[${i}] "${s.name}": notableNPCs references unknown NPC "${name}" — must be an existing NPC or one drafted in this batch`);
            }
        });
    });
}

function checkSessionLinks(blueprint, linkSets, errors) {
    (blueprint.sessions || []).forEach((s, i) => {
        for (const [kind, values] of Object.entries(s?.links || {})) {
            const known = linkSets[kind];
            if (!known) {
                errors.push(`sessions[${i}] "${s.name}": unknown link kind "${kind}"`);
                continue;
            }
            (values || []).forEach(v => {
                if (!known.has(lower(v))) {
                    errors.push(`sessions[${i}] "${s.name}": links.${kind} references unknown ${kind.slice(0, -1)} "${v}" — must exist in the campaign or be drafted in this batch`);
                }
            });
        }
    });
}

function checkMapPlans(blueprint, ctx, sets, encounterAware, errors) {
    const mapAware = new Set([...ctx.maps, ...sets.mapPlans.names]);
    (blueprint.mapPlans || []).forEach((plan, i) => {
        (plan?.dressing?.pois || []).forEach((poi, j) => {
            if (poi?.targetMap && !mapAware.has(lower(poi.targetMap))) {
                errors.push(`mapPlans[${i}] "${plan.name}": pois[${j}] targetMap "${poi.targetMap}" is not an existing map or one planned in this batch`);
            }
        });
        (plan?.dressing?.tokens || []).forEach((tok, j) => {
            if (!encounterAware.has(lower(tok?.encounterName))) {
                errors.push(`mapPlans[${i}] "${plan.name}": tokens[${j}] encounterName "${tok?.encounterName}" is not an existing encounter or one drafted in this batch`);
            }
        });
    });
}

// re-export so callers building partial contexts (tests, refine) can reuse it
export { lower as lowerName };
