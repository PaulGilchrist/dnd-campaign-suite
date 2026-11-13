// @maintained-by-ai
// Backlog (2026-11-12 WY) ai-dress-hides-vocabulary — the dress lane is
// ITEM-ops-only (validateLiveDressPlan rejects structural targets, pinned
// server entitySchemas.test.js:164). These pure predicates drive the modal's
// capability sentinel: fire ONLY for a structure-implied ask answered with an
// items-only proposal, never for plain furniture asks.
import { describe, it, expect } from 'vitest';
import {
    instructionImpliesStructure,
    proposalIncludesStructuralOps,
    structuralItemType,
    dressStructureNotice,
    STRUCTURE_SENTINEL,
} from './dressCapabilities.js';

describe('instructionImpliesStructure', () => {
    it('flags structural asks (the live WY-descent wording and its variants)', () => {
        expect(instructionImpliesStructure('enclose the room with walls')).toBe(true);
        expect(instructionImpliesStructure('Build a WALL around the throne')).toBe(true);
        expect(instructionImpliesStructure('enclose the chamber')).toBe(true);
        expect(instructionImpliesStructure('partition the hall with a barrier')).toBe(true);
        expect(instructionImpliesStructure('add a staircase to the upper level')).toBe(true);
        expect(instructionImpliesStructure('brick up the doorway')).toBe(true);
        expect(instructionImpliesStructure('fence off the clearing')).toBe(true);
        expect(instructionImpliesStructure('make structural changes to the keep')).toBe(true);
    });

    it('stays quiet on item-class asks (no false positives)', () => {
        expect(instructionImpliesStructure('add a table at 10,10 and two chairs')).toBe(false);
        expect(instructionImpliesStructure('add a trapped chest guarding the throne room, then line the gallery with banners')).toBe(false);
        expect(instructionImpliesStructure('add a door at 5,5')).toBe(false); // door is an advertised item TYPE
        expect(instructionImpliesStructure('add a chest beside the window')).toBe(false); // window names a prop too
    });

    it('tolerates junk input', () => {
        expect(instructionImpliesStructure('')).toBe(false);
        expect(instructionImpliesStructure(null)).toBe(false);
        expect(instructionImpliesStructure(undefined)).toBe(false);
        expect(instructionImpliesStructure(42)).toBe(false);
    });
});

describe('proposalIncludesStructuralOps', () => {
    it('recognises the item-class targets the schema validates', () => {
        expect(proposalIncludesStructuralOps([
            { op: 'add', target: 'item', item: { type: 'chest' }, gridX: 1, gridY: 2 },
            { op: 'add', target: 'poi', poi: { name: 'Shrine' }, gridX: 3, gridY: 4 },
            { op: 'add', target: 'token', token: { name: 'Goblin' }, gridX: 5, gridY: 6 },
        ])).toBe(false);
    });

    it('flags any non-item-class target (future-vocabulary honesty)', () => {
        expect(proposalIncludesStructuralOps([{ op: 'add', target: 'wall' }])).toBe(true);
        expect(proposalIncludesStructuralOps([])).toBe(false);
        expect(proposalIncludesStructuralOps(null)).toBe(false);
        expect(proposalIncludesStructuralOps([null])).toBe(false);
    });

    // bug-ai-dress-wall-as-item-sentinel-contradiction (live XA face): the
    // model smuggled the wall ask through as target:'item' rows — the preview
    // then READ "add wall at x,y" while the sentinel beside it claimed "no
    // structural changes". The gate must read the same words the preview does.
    it('flags wall-as-item smuggling on an item-class target (the live contradiction face)', () => {
        expect(proposalIncludesStructuralOps([
            { op: 'add', target: 'item', item: { type: 'wall' }, gridX: 4, gridY: 5 },
            { op: 'add', target: 'item', item: { type: 'chest' }, gridX: 5, gridY: 6 },
        ])).toBe(true);
        expect(proposalIncludesStructuralOps([
            { op: 'add', target: 'item', item: { type: 'prop', name: 'stone wall' }, gridX: 4, gridY: 5 },
        ])).toBe(true);
        // LIVE second face (fix-run): the model re-smuggled as snake_case
        // `type:'stone_wall'` — "_" is a \b word char, so the boundary law
        // must treat it as a separator, not glue.
        expect(proposalIncludesStructuralOps([
            { op: 'add', target: 'item', item: { type: 'stone_wall' }, gridX: 4, gridY: 5 },
        ])).toBe(true);
        // stairs-as-prop shares the preview vocabulary — the sentinel stays
        // quiet rather than claim "no structural changes" beside `add stairs`.
        expect(proposalIncludesStructuralOps([
            { op: 'add', target: 'item', item: { type: 'stairs' }, gridX: 4, gridY: 5 },
        ])).toBe(true);
    });

    it('plain props and POI labels never read as structural ops', () => {
        expect(proposalIncludesStructuralOps([
            { op: 'add', target: 'item', item: { type: 'chest', name: 'treasure chest' }, gridX: 5, gridY: 6 },
            { op: 'add', target: 'poi', poi: { name: 'Ruined Gateway' }, gridX: 1, gridY: 2 },
        ])).toBe(false);
    });
});

describe('structuralItemType — the server add-item refusal vocabulary', () => {
    it('refuses structural nouns that the map cannot render', () => {
        expect(structuralItemType('wall')).toBe(true);
        expect(structuralItemType('Walls')).toBe(true);
        expect(structuralItemType('stone wall')).toBe(true);
        expect(structuralItemType('stone_wall')).toBe(true); // snake_case re-smuggle
        expect(structuralItemType('barricade')).toBe(true);
        expect(structuralItemType('doorway')).toBe(true);
    });

    it('allows every prop noun the indoor map actually renders (itemSprites ART_TYPES)', () => {
        // door/stairs/secretDoor read structural in prose but are SERVED prop types.
        for (const type of ['door', 'secretDoor', 'stairs', 'arrowSlitWall', 'chest', 'table', 'torch']) {
            expect(structuralItemType(type)).toBe(false);
        }
    });

    it('tolerates junk input', () => {
        expect(structuralItemType('')).toBe(false);
        expect(structuralItemType('   ')).toBe(false);
        expect(structuralItemType(null)).toBe(false);
        expect(structuralItemType(42)).toBe(false);
    });
});

describe('dressStructureNotice', () => {
    const itemsOnly = { ops: [{ op: 'add', target: 'item', item: { type: 'table' }, gridX: 10, gridY: 10 }] };

    it('sentinels a structure-implied ask answered with items-only ops', () => {
        expect(dressStructureNotice('enclose the room with walls', itemsOnly)).toBe(STRUCTURE_SENTINEL);
        expect(STRUCTURE_SENTINEL).toBe('The model proposed no structural changes (dress supports items only).');
    });

    it('stays silent for purely item-only instructions (criterion 3)', () => {
        expect(dressStructureNotice('add a table at 10,10 and two chairs', itemsOnly)).toBeNull();
        expect(dressStructureNotice('trap the throne room', itemsOnly)).toBeNull();
    });

    it('stays silent before a proposal exists and when ops really are structural', () => {
        expect(dressStructureNotice('enclose the room with walls', null)).toBeNull();
        expect(dressStructureNotice('enclose the room with walls', { ops: [{ op: 'add', target: 'wall' }] })).toBeNull();
    });

    // The filed contradiction itself: structure ask + wall-NAMED item rows ⇒
    // the notice must go quiet (the preview is visibly listing walls).
    it('never contradicts a preview that lists wall-as-item rows', () => {
        const smuggled = {
            ops: [
                { op: 'add', target: 'item', item: { type: 'wall', name: 'stone wall' }, gridX: 4, gridY: 5 },
                { op: 'add', target: 'item', item: { type: 'chest' }, gridX: 5, gridY: 6 },
            ],
        };
        expect(dressStructureNotice('Build a stone wall around the center of the room and place a treasure chest inside the enclosure.', smuggled)).toBeNull();
    });
});
