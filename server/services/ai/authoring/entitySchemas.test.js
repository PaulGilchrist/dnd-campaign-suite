import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEntity, validateBlueprintShape, ENTITY_SCHEMAS } from './entitySchemas.js';

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
