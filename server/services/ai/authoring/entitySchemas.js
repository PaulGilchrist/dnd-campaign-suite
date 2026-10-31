/**
 * AI Campaign Authoring (plan Phase 1) — JSON Schema definitions for every
 * entity kind the AI designer can author, plus the blueprint/scope/map-plan
 * shapes that tie a generation together.
 *
 * Derivation is BYTES-FAITHFUL to the persisted rows and the editors that
 * render them:
 *  - quest/faction rows   → data/quests.json, data/factions.json (uuid id is
 *                           server-assigned — id/updatedAt are NOT in the
 *                           schemas and additionalProperties:false rejects any
 *                           attempt to send them)
 *  - npc/settlement/session → name-keyed PUT-upsert lanes (npcs.js,
 *                           settlements.js, sessions.js); NPC roleplay/stat
 *                           fields mirror npcFormUtils + the fixture row
 *  - encounter            → routes/encounters.js create lane (builder-preset
 *                           shape: selectedMonsters forced to {index,name,qty};
 *                           effectiveXP is computed server-side, never sent)
 *  - session links        → sessionPlannerUtils emptyLinks() (six arrays)
 *
 * Draft convention (owner ruling): AI-authored rows land with `draft: true`
 * on EVERY entity kind — a field orthogonal to gameplay lifecycle (quests
 * already own `status: active|completed|failed`, sessions `planned|played`),
 * stripped when the GM approves. `draft` is optional in the schemas because
 * the authoring service STAMPS it at apply time — the model may omit it, but
 * never set it false.
 *
 * Every schema is plain JSON Schema data (validator subset in
 * ./schemaValidator.js) so the same object can drive constrained decoding
 * (json_schema sampling) on capable backends later — one source of truth.
 */

import { validateAgainstSchema } from './schemaValidator.js';

// -- shared pieces ----------------------------------------------------------

const NAME = { type: 'string', minLength: 1, maxLength: 120 };
const TEXT = { type: 'string', maxLength: 8000 };
const SHORT = { type: 'string', maxLength: 500 };
const STRING_LIST = { type: 'array', items: { type: 'string', maxLength: 500 } };
const ABILITY_KEY = { type: 'integer', minimum: 3, maximum: 30 };
const MODIFIER = { type: 'integer', minimum: -5, maximum: 15 };
/** Draft flag: optional here, force-stamped true by the authoring service. */
const DRAFT = { type: 'boolean' };

// -- entities ---------------------------------------------------------------

export const factionSchema = {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
        name: NAME,
        description: TEXT,
        goals: TEXT,
        // Factions.jsx tiers: ≤3 low · ≤6 medium · ≤8 high → 1..10 scale.
        influence: { type: 'integer', minimum: 1, maximum: 10 },
        notes: TEXT,
        draft: DRAFT,
    },
};

export const questSchema = {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    // `status` is the QUEST LIFECYCLE (Quests.jsx STATUS_OPTIONS) — never the
    // draft flag; AI drafts open as 'active' unless the story says otherwise.
    properties: {
        name: NAME,
        status: { type: 'string', enum: ['active', 'completed', 'failed'] },
        description: TEXT,
        rewards: SHORT,
        notes: TEXT,
        draft: DRAFT,
    },
};

export const settlementSchema = {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
        name: NAME,
        size: { type: 'string', enum: ['village', 'town', 'city', 'metropolis'] },
        description: TEXT,
        atmosphere: TEXT,
        government: TEXT,
        population: SHORT,
        services: STRING_LIST,
        // Settlement ties to people — referential.js validates each name
        // against existing ∪ same-batch NPCs.
        notableNPCs: STRING_LIST,
        rumors: STRING_LIST,
        tags: SHORT,
        notes: TEXT,
        threat: TEXT,
        draft: DRAFT,
    },
};

export const npcSchema = {
    type: 'object',
    required: ['name'],
    // image/imageName/imagePath are GM-owned uploads — not AI-authorable.
    additionalProperties: false,
    properties: {
        name: NAME,
        race: SHORT,
        classRole: SHORT,
        appearance: TEXT,
        personality: TEXT,
        goals: TEXT,
        secrets: TEXT,
        notes: TEXT,
        tags: SHORT,
        attitude: {
            type: 'string',
            enum: ['deep bonds', 'positive', 'neutral', 'negative', 'extreme opposition'],
        },
        // Optional stat block (NPCStatBlockForm) — enough for a custom
        // combatant; pre-made monsters never go in npcs.json (bestiary guard
        // enforced in referential.js mirroring the npc CRUD route).
        armorClass: { type: ['integer', 'null'], minimum: 1, maximum: 40 },
        hitPoints: { type: ['integer', 'null'], minimum: 1, maximum: 2000 },
        hitDice: SHORT,
        initiativeBonus: { type: 'string', maxLength: 10 },
        speed: { type: 'object', additionalProperties: { type: 'string', maxLength: 60 } },
        abilityScores: {
            type: 'object',
            required: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
            additionalProperties: false,
            properties: {
                str: ABILITY_KEY, dex: ABILITY_KEY, con: ABILITY_KEY,
                int: ABILITY_KEY, wis: ABILITY_KEY, cha: ABILITY_KEY,
            },
        },
        savingThrowBonuses: { type: 'object', additionalProperties: MODIFIER },
        skillBonuses: { type: 'object', additionalProperties: MODIFIER },
        damageResistances: STRING_LIST,
        damageImmunities: STRING_LIST,
        conditionImmunities: STRING_LIST,
        actions: {
            type: 'array',
            items: {
                type: 'object',
                required: ['name', 'description'],
                additionalProperties: true,
                properties: { name: SHORT, description: TEXT },
            },
        },
        traits: TEXT,
        reactions: TEXT,
        draft: DRAFT,
    },
};

export const sessionSchema = {
    type: 'object',
    required: ['name'],
    additionalProperties: false,
    properties: {
        name: NAME,
        date: { type: 'string', maxLength: 40 },
        // Known session lifecycle values (getDefaultSessionData / played mark).
        status: { type: 'string', enum: ['planned', 'played'] },
        summary: TEXT,
        notes: TEXT,
        contingencies: STRING_LIST,
        // sessionPlannerUtils emptyLinks(): six named resource arrays. The
        // picker stores whatever the list lane keys on (names for npcs/maps/
        // encounters/settlements, ids for quests/notes) — referential.js
        // accepts either face.
        links: {
            type: 'object',
            additionalProperties: false,
            properties: {
                maps: STRING_LIST,
                encounters: STRING_LIST,
                npcs: STRING_LIST,
                quests: STRING_LIST,
                settlements: STRING_LIST,
                notes: STRING_LIST,
            },
        },
        draft: DRAFT,
    },
};

export const encounterSchema = {
    type: 'object',
    required: ['name'],
    // creatures/savedAt/round belong to saved-initiative snapshots; the AI
    // authors BUILDER PRESETS (selectedMonsters pull real monsters.json rows).
    additionalProperties: false,
    properties: {
        name: NAME,
        description: TEXT,
        selectedMonsters: {
            type: 'array',
            items: {
                type: 'object',
                required: ['index', 'name', 'qty'],
                additionalProperties: false,
                properties: {
                    index: { type: 'string', minLength: 1, maxLength: 120 },
                    name: { type: 'string', minLength: 1, maxLength: 120 },
                    qty: { type: 'integer', minimum: 1, maximum: 100 },
                },
            },
        },
        draft: DRAFT,
    },
};

// -- map plans (Phase 5 pipeline contract) -----------------------------------

/**
 * The model never emits raw grid JSON (corruption risk) — it emits generator
 * params plus a DRESSING PLAN a deterministic applier executes against the
 * in-process generator output (src/services/maps/*.js).
 */
export const mapPlanSchema = {
    type: 'object',
    required: ['name', 'displayName', 'generator'],
    additionalProperties: false,
    properties: {
        // kebab-case file name the maps lane stores (maps/<name>.json).
        name: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,99}$' },
        displayName: NAME,
        generator: { type: 'string', enum: ['hex', 'dungeon'] },
        params: {
            type: 'object',
            additionalProperties: false,
            properties: {
                gridSize: { type: 'integer', minimum: 5, maximum: 120 },
                density: { type: 'number', minimum: 0, maximum: 1 },
                seed: { type: 'integer', minimum: 0, maximum: 1000000000 },
                weights: { type: 'object', additionalProperties: { type: 'number' } },
            },
        },
        dressing: {
            type: 'object',
            additionalProperties: false,
            properties: {
                pois: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['name', 'gridX', 'gridY'],
                        additionalProperties: false,
                        properties: {
                            name: NAME,
                            description: TEXT,
                            gridX: { type: 'integer', minimum: 0, maximum: 200 },
                            gridY: { type: 'integer', minimum: 0, maximum: 200 },
                            // Outward tie: POI portal → another map's kebab name.
                            targetMap: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,99}$' },
                        },
                    },
                },
                placedItemOps: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['op'],
                        additionalProperties: false,
                        properties: {
                            op: { type: 'string', enum: ['add', 'remove', 'move'] },
                            item: {
                                type: 'object',
                                additionalProperties: true,
                                properties: {
                                    type: SHORT,
                                    name: SHORT,
                                    gridX: { type: 'integer', minimum: 0, maximum: 200 },
                                    gridY: { type: 'integer', minimum: 0, maximum: 200 },
                                },
                            },
                            // remove/move address the Nth generated item.
                            itemIndex: { type: 'integer', minimum: 0, maximum: 5000 },
                            gridX: { type: 'integer', minimum: 0, maximum: 200 },
                            gridY: { type: 'integer', minimum: 0, maximum: 200 },
                        },
                    },
                },
                tokens: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['encounterName', 'creatureName', 'gridX', 'gridY'],
                        additionalProperties: false,
                        properties: {
                            encounterName: NAME,
                            creatureName: NAME,
                            gridX: { type: 'integer', minimum: 0, maximum: 200 },
                            gridY: { type: 'integer', minimum: 0, maximum: 200 },
                        },
                    },
                },
            },
        },
        draft: DRAFT,
    },
};

// -- designer protocol (Phase 4 contract) ------------------------------------

const ENTITY_KINDS = ['faction', 'npc', 'settlement', 'quest', 'encounter', 'session', 'mapPlan'];

export const scopeSchema = {
    type: 'object',
    required: ['scope'],
    additionalProperties: false,
    properties: {
        // Owner ruling: scope is conversational — a fresh campaign, a one-shot,
        // an arc extension for party levels 6-10, or prep for the next session.
        scope: { type: 'string', enum: ['campaign', 'one_shot', 'arc', 'session', 'bespoke'] },
        levelRange: {
            type: 'object',
            required: ['min', 'max'],
            additionalProperties: false,
            properties: {
                min: { type: 'integer', minimum: 1, maximum: 20 },
                max: { type: 'integer', minimum: 1, maximum: 20 },
            },
        },
        sessionNumber: { type: 'integer', minimum: 1, maximum: 1000 },
        storySummary: TEXT,
        entityPlan: {
            type: 'array',
            items: {
                type: 'object',
                required: ['kind', 'count'],
                additionalProperties: false,
                properties: {
                    kind: { type: 'string', enum: ENTITY_KINDS },
                    count: { type: 'integer', minimum: 0, maximum: 100 },
                    notes: SHORT,
                },
            },
        },
    },
};

export const blueprintSchema = {
    type: 'object',
    required: ['scope'],
    additionalProperties: false,
    // Each list holds schema-valid rows; referential.js then proves the set
    // hangs together (inward) and hooks into the live campaign (outward).
    properties: {
        scope: scopeSchema,
        factions: { type: 'array', items: { $ref: '#/faction' } },
        settlements: { type: 'array', items: { $ref: '#/settlement' } },
        npcs: { type: 'array', items: { $ref: '#/npc' } },
        quests: { type: 'array', items: { $ref: '#/quest' } },
        encounters: { type: 'array', items: { $ref: '#/encounter' } },
        sessions: { type: 'array', items: { $ref: '#/session' } },
        mapPlans: { type: 'array', items: { $ref: '#/mapPlan' } },
    },
};

/** kind → row schema, for per-entity refine (Phase 6) and blueprint walks. */
export const ENTITY_SCHEMAS = {
    faction: factionSchema,
    quest: questSchema,
    settlement: settlementSchema,
    npc: npcSchema,
    session: sessionSchema,
    encounter: encounterSchema,
    mapPlan: mapPlanSchema,
    // $ref roots used inside blueprintSchema:
    scope: scopeSchema,
    blueprint: blueprintSchema,
};

export { ENTITY_KINDS };

// -- validation entry points (fail-closed { ok, errors }, see ../schemas.js
//    convention) -------------------------------------------------------------

/** Validate one authored row of a known kind against its entity schema. */
export function validateEntity(kind, row) {
    const schema = ENTITY_SCHEMAS[kind];
    if (!schema) return { ok: false, errors: [`unknown entity kind: ${JSON.stringify(kind)}`] };
    return validateAgainstSchema(row, schema, { schemas: ENTITY_SCHEMAS });
}

/** Whole-blueprint shape check (structure only — refs are referential.js's job). */
export function validateBlueprintShape(blueprint) {
    return validateAgainstSchema(blueprint, blueprintSchema, { schemas: ENTITY_SCHEMAS });
}
