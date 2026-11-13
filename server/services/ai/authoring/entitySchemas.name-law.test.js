// @maintained-by-ai
// Regression (bug-designer-draft-accepts-kind-word-entity-name): namingRule()
// told the model never to name an entity after its kind or a placeholder, but
// validateEntity() was schema-only — a draft named "npc" passed every lane and
// Approve made it LIVE. These tests pin the enforcement half of that law.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEntity, ENTITY_KINDS, ENTITY_SCHEMAS } from './entitySchemas.js';
import { NAME_LAW_KIND_WORDS, NAME_PLACEHOLDERS, nameLawViolation } from '../../../../src/services/ai/entityNameLaw.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = name => JSON.parse(fs.readFileSync(
    path.resolve(here, '..', '..', '..', '..', 'public', 'campaigns', 'test-campaign', 'data', name), 'utf-8'
));
const SERVER_OWNED = ['id', 'updatedAt', 'image', 'imageName', 'imagePath'];
const asAuthored = row => Object.fromEntries(
    Object.entries(row).filter(([key]) => !SERVER_OWNED.includes(key))
);

const errorsFor = (kind, row) => {
    const res = validateEntity(kind, row);
    expect(res.ok, `expected ${kind} ${JSON.stringify(row)} to be rejected`).toBe(false);
    return res.errors.join('; ');
};

describe('validateEntity — the kind-word half of the name law', () => {
    it('refuses the exact kind word for every authorable kind (the live repro)', () => {
        // The bug: resume drafted the harbourmaster NPC with name "npc".
        expect(errorsFor('npc', { name: 'npc', personality: 'Suspicious' })).toMatch(/name "npc" is a kind word/);
        for (const kind of ENTITY_KINDS) {
            const res = validateEntity(kind, { name: kind });
            expect(res.ok, kind).toBe(false);
            expect(res.errors.join(' ')).toMatch(/kind word/);
        }
    });

    it('refuses case, plural, snake and kebab spellings of the leak', () => {
        expect(errorsFor('npc', { name: 'NPC' })).toMatch(/kind word/);
        expect(errorsFor('npc', { name: 'NPCs' })).toMatch(/kind word/);
        expect(errorsFor('quest', { name: 'quest' })).toMatch(/kind word/);
        expect(errorsFor('mapPlan', { name: 'map-plan', displayName: 'Fungal Hollows', generator: 'dungeon' })).toMatch(/name "map-plan" is a kind word/);
        expect(errorsFor('mapPlan', { name: 'map_plan', displayName: 'Fungal Hollows', generator: 'dungeon' })).toMatch(/name "map_plan" is a kind word/);
    });

    it('refuses every placeholder the prompt advertises, plus "New <kind>"', () => {
        for (const p of NAME_PLACEHOLDERS) expect(errorsFor('npc', { name: p })).toMatch(/placeholder/);
        expect(errorsFor('npc', { name: 'TBD' })).toMatch(/placeholder/);
        expect(errorsFor('faction', { name: 'New faction' })).toMatch(/placeholder/);
        expect(errorsFor('mapPlan', { name: 'new-map-plan', displayName: 'My Map', generator: 'dungeon' })).toMatch(/placeholder/);
    });

    it('mapPlan is checked on displayName too', () => {
        expect(errorsFor('mapPlan', { name: 'sunken-temple', displayName: 'Untitled', generator: 'dungeon' })).toMatch(/displayName "Untitled" is a placeholder/);
    });

    it('never double-reports: a missing/blank name stays the schema’s error alone', () => {
        const res = validateEntity('npc', { personality: 'Gruff' });
        expect(res.ok).toBe(false);
        expect(res.errors.join(' ')).not.toMatch(/kind word|placeholder/);
    });
});

describe('validateEntity — compliant names are untouched', () => {
    it('accepts proper in-world names, including ones merely CONTAINING a law word', () => {
        expect(validateEntity('npc', { name: 'Marta Copperkettle', personality: 'Suspicious' }).ok).toBe(true);
        expect(validateEntity('npc', { name: 'Testament of the Deep' }).ok).toBe(true);
        expect(validateEntity('faction', { name: 'The Testing Grounds Guild' }).ok).toBe(true);
        expect(validateEntity('encounter', { name: 'Ambush at Wolf Hollow', selectedMonsters: [] }).ok).toBe(true);
        expect(validateEntity('mapPlan', { name: 'sunken-temple', displayName: 'Sunken Temple', generator: 'dungeon' }).ok).toBe(true);
    });

    it('every REAL test-campaign row still validates (law never false-positives on canon)', () => {
        for (const [file, kind] of [['quests.json', 'quest'], ['factions.json', 'faction'],
            ['settlements.json', 'settlement'], ['npcs.json', 'npc']]) {
            for (const row of fixture(file)) {
                const res = validateEntity(kind, asAuthored(row));
                expect(res.errors, `${kind} ${row.name}: ${res.errors.join('; ')}`).toEqual([]);
            }
        }
    });
});

describe('nameLawViolation — the shared predicate', () => {
    it('stays in lockstep with the schemas’ ENTITY_KINDS (no silent drift)', () => {
        expect([...NAME_LAW_KIND_WORDS].sort()).toEqual([...ENTITY_KINDS].sort());
        for (const kind of ENTITY_KINDS) expect(ENTITY_SCHEMAS[kind], kind).toBeTruthy();
    });

    it('returns null for non-string/blank names (absence is the schema validator’s job)', () => {
        expect(nameLawViolation('npc', 123)).toBeNull();
        expect(nameLawViolation('npc', '')).toBeNull();
        expect(nameLawViolation('npc', undefined)).toBeNull();
    });

    it('reports the field it was asked about', () => {
        expect(nameLawViolation('mapPlan', 'npc', 'displayName')).toMatch(/^displayName "npc"/);
    });
});
