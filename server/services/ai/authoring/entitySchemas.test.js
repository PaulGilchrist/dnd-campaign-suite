import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEntity, validateBlueprintShape, validateLiveDressPlan, resolveSchemaRefs, liveDressPlanSchema, ENTITY_SCHEMAS } from './entitySchemas.js';
import { validateAgainstSchema } from './schemaValidator.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = name => JSON.parse(fs.readFileSync(
    path.resolve(here, '..', '..', '..', '..', 'public', 'campaigns', 'test-campaign', 'data', name), 'utf-8'
));

/** Server/GM-owned fields stripped the way an AI-authored row would arrive. */
const SERVER_OWNED = ['id', 'updatedAt', 'image', 'imageName', 'imagePath'];
const asAuthored = row => Object.fromEntries(
    Object.entries(row).filter(([key]) => !SERVER_OWNED.includes(key))
);

describe('authoring entity schemas mirror the persisted row shapes', () => {
    it('accepts every REAL test-campaign quest/faction/settlement/npc row (minus server fields)', () => {
        const kinds = [['quests.json', 'quest'], ['factions.json', 'faction'],
            ['settlements.json', 'settlement'], ['npcs.json', 'npc']];
        for (const [file, kind] of kinds) {
            for (const row of fixture(file)) {
                const res = validateEntity(kind, asAuthored(row));
                expect(res.errors, `${kind} ${row.name}: ${res.errors.join('; ')}`).toEqual([]);
            }
        }
    });

    it('rejects server-owned fields (id/updatedAt/image uploads) on authored rows', () => {
        expect(validateEntity('quest', { name: 'Q', id: 'x' }).ok).toBe(false);
        expect(validateEntity('faction', { name: 'F', updatedAt: 1 }).ok).toBe(false);
        expect(validateEntity('npc', { name: 'N', image: 'data:...' }).ok).toBe(false);
    });

    it('keeps quest lifecycle status separate from the draft flag', () => {
        expect(validateEntity('quest', { name: 'Q', status: 'active', draft: true }).ok).toBe(true);
        expect(validateEntity('quest', { name: 'Q', status: 'draft' }).ok).toBe(false);
        expect(validateEntity('quest', { name: 'Q', draft: false }).ok).toBe(true); // schema-tolerant; the authoring service force-stamps true regardless
    });

    it('validates the enums the editors actually offer', () => {
        expect(validateEntity('settlement', { name: 'S', size: 'town' }).ok).toBe(true);
        expect(validateEntity('settlement', { name: 'S', size: 'kingdom' }).ok).toBe(false);
        expect(validateEntity('npc', { name: 'N', attitude: 'positive' }).ok).toBe(true);
        expect(validateEntity('npc', { name: 'N', attitude: 'wary' }).ok).toBe(false);
        expect(validateEntity('session', { name: 'S1', status: 'planned' }).ok).toBe(true);
        expect(validateEntity('session', { name: 'S1', status: 'done' }).ok).toBe(false);
    });

    it('requires bestiary monster rows (index+name+qty) in encounters', () => {
        const good = { name: 'Ambush', selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }] };
        expect(validateEntity('encounter', good).ok).toBe(true);
        expect(validateEntity('encounter', { ...good, effectiveXP: 100 }).ok).toBe(false);
        expect(validateEntity('encounter', { name: 'E', selectedMonsters: [{ index: 'goblin', qty: 1 }] }).ok).toBe(false);
    });

    it('map plans forbid raw grid JSON — only generator params + dressing', () => {
        const plan = {
            name: 'sunken-temple',
            displayName: 'Sunken Temple',
            generator: 'dungeon',
            params: { gridSize: 30, density: 0.5, seed: 7 },
            dressing: {
                pois: [{ name: 'Altar', gridX: 5, gridY: 9, targetMap: 'test-map' }],
                placedItemOps: [{ op: 'add', item: { type: 'chest', gridX: 6, gridY: 6 } }],
                tokens: [{ encounterName: 'Ambush', creatureName: 'Goblin', gridX: 4, gridY: 4 }],
            },
        };
        expect(validateEntity('mapPlan', plan).ok).toBe(true);
        expect(validateEntity('mapPlan', { ...plan, walls: [[0, 0]] }).ok).toBe(false);
    });
});

describe('blueprint shape', () => {
    it('accepts a scope + cross-populated entity lists via $ref roots', () => {
        const bp = {
            scope: { scope: 'session', sessionNumber: 4, entityPlan: [{ kind: 'encounter', count: 1 }] },
            npcs: [{ name: 'Oldhem', draft: true }],
            settlements: [{ name: 'Mudport', size: 'village', notableNPCs: ['Oldhem'] }],
            encounters: [{ name: 'Ambush', selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }] }],
            sessions: [{ name: 'Session 4', links: { encounters: ['Ambush'], npcs: ['Oldhem'] } }],
        };
        const res = validateBlueprintShape(bp);
        expect(res.errors).toEqual([]);
    });

    it('rejects unknown blueprint keys and bad scopes', () => {
        expect(validateBlueprintShape({ scope: { scope: 'campaign' }, dragons: [] }).ok).toBe(false);
        expect(validateBlueprintShape({ scope: { scope: 'weekend' } }).ok).toBe(false);
        expect(validateBlueprintShape({}).ok).toBe(false); // scope required
    });

    it('exposes every authorable kind in the $ref root', () => {
        for (const kind of ['faction', 'npc', 'settlement', 'quest', 'encounter', 'session', 'mapPlan']) {
            expect(ENTITY_SCHEMAS[kind], kind).toBeTruthy();
        }
    });
});

describe('resolveSchemaRefs — constrained decoding off the same objects', () => {
    const noRefs = (node) => {
        if (Array.isArray(node)) return node.every(noRefs);
        if (node && typeof node === 'object') {
            if ('$ref' in node) return false;
            return Object.values(node).every(noRefs);
        }
        return true;
    };

    it('inlines sibling-map refs into a self-contained standard schema', () => {
        const resolved = resolveSchemaRefs(ENTITY_SCHEMAS.blueprint);
        expect(noRefs(resolved)).toBe(true);
        // The faction row's shape landed inside blueprint.properties.factions.
        expect(resolved.properties.factions.items).toMatchObject({
            required: ['name'], additionalProperties: false,
        });
        expect(resolved.properties.factions.items.properties.name).toBeTruthy();
    });

    it('the resolved blueprint still fails closed on server-owned fields', () => {
        const bad = {
            scope: { scope: 'bespoke' },
            factions: [{ name: 'Doom', id: 'forged', updatedAt: 3 }],
        };
        const res = validateAgainstSchema(bad, resolveSchemaRefs(ENTITY_SCHEMAS.blueprint));
        expect(res.ok).toBe(false);
        expect(res.errors.join(' ')).toMatch(/unknown field 'id'/);
        expect(res.errors.join(' ')).toMatch(/unknown field 'updatedAt'/);
    });

    it('per-entity schemas resolve standalone (refine feeds these directly)', () => {
        const enc = resolveSchemaRefs(ENTITY_SCHEMAS.encounter);
        expect(noRefs(enc)).toBe(true);
        expect(validateAgainstSchema({ name: 'E', selectedMonsters: [] }, enc).ok).toBe(true);
    });
});

describe('liveDressPlan schema (AI Dress — ops address the LIVE document)', () => {
    it('accepts the full verb/target vocabulary of in-place dressing', () => {
        const res = validateLiveDressPlan({
            ops: [
                { op: 'add', target: 'item', item: { type: 'chest', name: 'Ransom chest' }, gridX: 12, gridY: 8 },
                { op: 'remove', target: 'item', id: 'torch-0-2-4' },
                { op: 'move', target: 'token', id: 'tok-goblin-1', gridX: 9, gridY: 6 },
                { op: 'add', target: 'poi', poi: { name: 'Temple Door', targetMap: 'sunken-temple' }, gridX: 3, gridY: 4 },
                { op: 'remove', target: 'poi', id: 'ai-dress-poi-3-4-0' },
            ],
        });
        expect(res.errors).toEqual([]);
    });

    it('walls/paint/fog/image layers are inexpressible — unknown fields fail closed', () => {
        expect(validateLiveDressPlan({ ops: [{ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 1, gridY: 1, layer: 'fog' }] }).ok).toBe(false);
        expect(validateLiveDressPlan({ ops: [{ op: 'paint', target: 'walls' }] }).ok).toBe(false);
        // …and no raw-grid smuggling alongside the ops either.
        const smuggle = validateLiveDressPlan({ ops: [{ op: 'remove', target: 'item', id: 'x' }], walls: [[0, 0]] });
        expect(smuggle.ok).toBe(false);
        expect(smuggle.errors.join(' ')).toMatch(/unknown field 'walls'/);
    });

    it('targets and ids are constrained: unknown targets, empty id, empty op list', () => {
        expect(validateLiveDressPlan({ ops: [{ op: 'add', target: 'wall' }] }).ok).toBe(false);
        expect(validateLiveDressPlan({ ops: [{ op: 'remove', target: 'item', id: '' }] }).ok).toBe(false);
        expect(validateLiveDressPlan({ ops: [] }).ok).toBe(false); // minItems 1
        expect(validateLiveDressPlan({}).ok).toBe(false);          // ops required
    });

    it('is self-contained (constrained decoding can send it verbatim)', () => {
        expect(JSON.stringify(liveDressPlanSchema)).not.toContain('$ref');
    });
});
